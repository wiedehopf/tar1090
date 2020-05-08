#!/bin/bash
set -e

trap 'echo "[ERROR] Error in line $LINENO when executing: $BASH_COMMAND"' ERR

srcdir=/run/dump1090-fa
repo="https://github.com/wiedehopf/tar1090"
db_repo="https://github.com/wiedehopf/tar1090-db"
ipath=/usr/local/share/tar1090
lighttpd=no
nginx=no

mkdir -p $ipath

if ! id -u tar1090 &>/dev/null
then
    adduser --system --home $ipath --no-create-home --quiet tar1090
fi

command_package="git git/jq jq/7za p7zip-full/"
packages=""

while read -r -d '/' CMD PKG
do
    if ! command -v "$CMD" &>/dev/null
    then
        echo "command $CMD not found, will try to install package $PKG"
        packages+="$PKG "
    fi
done < <(echo "$command_package")

if [[ -n "$packages" ]]
then
    echo "Installing required packages: $packages"
    apt-get update || true
    if ! apt-get install -y $packages
    then
        echo "Failed to install required packages: $packages"
        echo "Exiting ..."
        exit 1
    fi
    hash -r || true
fi

if [ -d /etc/lighttpd/conf.d/ ] && ! [ -d /etc/lighttpd/conf-enabled/ ] && ! [ -d /etc/lighttpd/conf-available ] && command -v lighttpd &>/dev/null
then
    ln -s /etc/lighttpd/conf.d /etc/lighttpd/conf-enabled
    mkdir -p /etc/lighttpd/conf-available
fi

if [ -d /etc/lighttpd/conf-enabled/ ] && [ -d /etc/lighttpd/conf-available ] && command -v lighttpd &>/dev/null
then
    lighttpd=yes
fi

if command -v nginx &>/dev/null
then
    nginx=yes
fi

dir=$(pwd)

if { ! [ -d "$ipath/git-db" ] && git clone --depth 1 $db_repo $ipath/git-db; } || { cd $ipath/git-db && ! [[ "$1" == "test" ]] ; }
then
    cd $ipath/git-db
    git fetch --depth 1 origin master
    git reset --hard origin/master
fi

cd $ipath/git-db
DB_VERSION=$(git rev-parse --short HEAD)

cd "$dir"

if [[ "$1" == "test" ]]
then
    rm -r /tmp/tar1090-test 2>/dev/null || true
    mkdir -p /tmp/tar1090-test
    cp -r ./* /tmp/tar1090-test
    cd /tmp/tar1090-test

elif { ! [ -d "$ipath/git" ] && git clone --single-branch -b master --depth 1 $repo $ipath/git; } || cd $ipath/git
then
    cd $ipath/git
    git fetch origin master
    git reset --hard origin/master

elif wget --timeout=30 -q -O /tmp/master.zip $repo/archive/master.zip && unzip -q -o master.zip
then
    cd /tmp/tar1090-master
else
    echo "Unable to download files, exiting! (Maybe try again?)"
    exit 1
fi

if git rev-parse --short HEAD &>/dev/null; then
    TAR_VERSION="$(git rev-parse --short HEAD)_$DB_VERSION"
else
    TAR_VERSION=$(date +%s)
fi


if [ -f /etc/default/tar1090_instances ]; then
    true
elif [[ -n $1 ]] && [ "$1" != "test" ] ; then
    srcdir=$1
elif [[ -f /run/dump1090-fa/aircraft.json ]] ; then
    srcdir=/run/dump1090-fa
elif [[ -f /run/readsb/aircraft.json ]]; then
    srcdir=/run/readsb
elif [[ -f /run/adsbexchange-feed/aircraft.json ]]; then
    srcdir=/run/adsbexchange-feed
elif [[ -f /run/dump1090/aircraft.json ]]; then
    srcdir=/run/dump1090
elif [[ -f /run/dump1090-mutability/aircraft.json ]]; then
    srcdir=/run/dump1090-mutability
elif [[ -f /run/skyaware978/aircraft.json ]]; then
    srcdir=/run/skyaware978
else
    echo --------------
    echo FATAL: could not find aircraft.json in any of the usual places!
    echo "checked these: /run/readsb /run/dump1090-fa /run/dump1090 /run/dump1090-mutability /run/adsbexchange-feed /run/skyaware978"
    echo --------------
    exit 1
fi

if [ -f /etc/default/tar1090_instances ]; then
    instances=$(</etc/default/tar1090_instances)	
else
    instances="$srcdir tar1090"
fi

if ! diff tar1090.sh /usr/local/share/tar1090/tar1090.sh &>/dev/null; then
    changed=yes
    while read -r srcdir instance; do
        if [[ "$instance" != "tar1090" ]]; then
            service="tar1090-$instance"
        else
            service="tar1090"
        fi
        systemctl stop $service 2>/dev/null || true
    done < <(echo "$instances")
    cp tar1090.sh $ipath
fi


# copy over base files
cp default install.sh uninstall.sh LICENSE README.md \
    $ipath


services=""
names=""
otherport=""

while read -r srcdir instance
do
    TMP=$(mktemp -d -p $ipath)
    chmod 755 $TMP

    if [[ "$instance" != "tar1090" ]]; then
        html_path="$ipath/html-$instance"
        service="tar1090-$instance"
    else
        html_path="$ipath/html"
        service="tar1090"
    fi
    services+="$service "
    names+="$instance "

    # don't overwrite existing configuration
    cp -n default /etc/default/$service
    sed -i -e 's/skyview978/skyaware978/' /etc/default/$service

    sed -i.orig -e "s?SOURCE_DIR?$srcdir?g" -e "s?SERVICE?$service?g" \
        -e "s?/INSTANCE??g" -e "s?HTMLPATH?$html_path?g" 95-tar1090-otherport.conf

        if [[ "$instance" == "webroot" ]]
        then
        sed -i.orig -e "s?SOURCE_DIR?$srcdir?g" -e "s?SERVICE?$service?g" \
        -e "s?/INSTANCE??g" -e "s?HTMLPATH?$html_path?g" 88-tar1090.conf
        sed -i.orig -e "s?SOURCE_DIR?$srcdir?g" -e "s?SERVICE?$service?g" \
        -e "s?/INSTANCE/?/?g" -e "s?HTMLPATH?$html_path?g" nginx.conf
        sed -i -e "s?/INSTANCE?/?g" nginx.conf

        else

        sed -i.orig -e "s?SOURCE_DIR?$srcdir?g" -e "s?SERVICE?$service?g" \
        -e "s?INSTANCE?$instance?g" -e "s?HTMLPATH?$html_path?g" 88-tar1090.conf
        sed -i.orig -e "s?SOURCE_DIR?$srcdir?g" -e "s?SERVICE?$service?g" \
        -e "s?INSTANCE?$instance?g" -e "s?HTMLPATH?$html_path?g" nginx.conf

        fi

    sed -i.orig -e "s?SOURCE_DIR?$srcdir?g" -e "s?SERVICE?$service?g" tar1090.service

    cp -r -T html $TMP
    cp -r -T $ipath/git-db/db $TMP/db-$DB_VERSION
    sed -i -e "s/let databaseFolder = .*/let databaseFolder = \"db-$DB_VERSION\";/" $TMP/early.js
    echo "{ \"tar1090Version\": \"$TAR_VERSION\", \"databaseVersion\": \"$DB_VERSION\" }" > $TMP/version.json

    # keep some stuff around
    if [ -f $html_path/defaults*.js ]; then
        mv $html_path/config.js $TMP/config.js 2>/dev/null || true
    fi
    mv $html_path/color*.css $TMP/colors.css 2>/dev/null || true
    mv $html_path/upintheair.json $TMP/upintheair.json 2>/dev/null || true

    # bust cache for all css and js files

    dir=$(pwd)
    cd $TMP

    sed -i -e "s/tar1090 on github/tar1090 on github ($(date +%y%m%d))/" index.html

    sed -i \
        -e "s/dbloader.js/dbloader_$TAR_VERSION.js/" \
        -e "s/defaults.js/defaults_$TAR_VERSION.js/" \
        -e "s/early.js/early_$TAR_VERSION.js/" \
        -e "s/flags.js/flags_$TAR_VERSION.js/" \
        -e "s/formatter.js/formatter_$TAR_VERSION.js/" \
        -e "s/layers.js/layers_$TAR_VERSION.js/" \
        -e "s/markers.js/markers_$TAR_VERSION.js/" \
        -e "s/planeObject.js/planeObject_$TAR_VERSION.js/" \
        -e "s/registrations.js/registrations_$TAR_VERSION.js/" \
        -e "s/script.js/script_$TAR_VERSION.js/" \
        -e "s/colors.css/colors_$TAR_VERSION.css/" \
        -e "s/style.css/style_$TAR_VERSION.css/" \
        index.html

    mv dbloader.js dbloader_$TAR_VERSION.js
    mv defaults.js defaults_$TAR_VERSION.js
    mv early.js early_$TAR_VERSION.js
    mv flags.js flags_$TAR_VERSION.js
    mv formatter.js formatter_$TAR_VERSION.js
    mv layers.js layers_$TAR_VERSION.js
    mv markers.js markers_$TAR_VERSION.js
    mv planeObject.js planeObject_$TAR_VERSION.js
    mv registrations.js registrations_$TAR_VERSION.js
    mv script.js script_$TAR_VERSION.js
    mv colors.css colors_$TAR_VERSION.css
    mv style.css style_$TAR_VERSION.css

    if [[ $nginx == yes ]]; then
        gzip -k -9 dbloader_$TAR_VERSION.js
        gzip -k -9 defaults_$TAR_VERSION.js
        gzip -k -9 early_$TAR_VERSION.js
        gzip -k -9 flags_$TAR_VERSION.js
        gzip -k -9 formatter_$TAR_VERSION.js
        gzip -k -9 layers_$TAR_VERSION.js
        gzip -k -9 markers_$TAR_VERSION.js
        gzip -k -9 planeObject_$TAR_VERSION.js
        gzip -k -9 registrations_$TAR_VERSION.js
        gzip -k -9 script_$TAR_VERSION.js
        gzip -k -9 colors_$TAR_VERSION.css
        gzip -k -9 style_$TAR_VERSION.css

        gzip -k -9 jquery/*.js
        gzip -k -9 ol/*.js
        #gzip -k -9 db2/*.json .... already exists compressed
    fi
    GARBAGE="$ipath/$RANDOM.$RANDOM"

    mv $html_path $GARBAGE 2>/dev/null || true
    mv $TMP $html_path
    rm -rf $GARBAGE 2>/dev/null || true

    cd "$dir"

    cp nginx.conf $ipath/nginx-$service.conf

    if [[ $lighttpd == yes ]] &>/dev/null
    then
        if [[ "$otherport" != "done" ]]; then
            cp 95-tar1090-otherport.conf /etc/lighttpd/conf-available/
            ln -f -s /etc/lighttpd/conf-available/95-tar1090-otherport.conf /etc/lighttpd/conf-enabled/95-tar1090-otherport.conf
            otherport="done"
            if [ -f /etc/lighttpd/conf.d/69-skybup.conf ]; then
                mv /etc/lighttpd/conf-enabled/95-tar1090-otherport.conf /etc/lighttpd/conf-enabled/68-tar1090-otherport.conf
            fi
        fi
        if [ -f /etc/lighttpd/conf.d/69-skybup.conf ] && [[ "$instance" == "webroot" ]]; then
            true
        elif [[ "$instance" == "webroot" ]]
        then
            cp 88-tar1090.conf /etc/lighttpd/conf-available/99-$service.conf
            ln -f -s /etc/lighttpd/conf-available/99-$service.conf /etc/lighttpd/conf-enabled/99-$service.conf
        else
            cp 88-tar1090.conf /etc/lighttpd/conf-available/88-$service.conf
            ln -f -s /etc/lighttpd/conf-available/88-$service.conf /etc/lighttpd/conf-enabled/88-$service.conf
            if [ -f /etc/lighttpd/conf.d/69-skybup.conf ]; then
                mv /etc/lighttpd/conf-enabled/88-$service.conf /etc/lighttpd/conf-enabled/66-$service.conf
            fi
        fi
    fi

    if [[ $changed == yes ]] || ! diff tar1090.service /lib/systemd/system/$service.service &>/dev/null
    then
        cp tar1090.service /lib/systemd/system/$service.service
        if systemctl enable $service
        then
            echo "Restarting $service ..."
            systemctl restart $service
        else
            echo "$service.service is masked, could not start it!"
        fi
    fi

    # restore sed modified configuration files
    mv 88-tar1090.conf.orig 88-tar1090.conf
    mv 95-tar1090-otherport.conf.orig 95-tar1090-otherport.conf
    mv nginx.conf.orig nginx.conf
    mv tar1090.service.orig tar1090.service
done < <(echo "$instances")


if [ -d /etc/lighttpd/conf-enabled/ ] && [ -f /etc/lighttpd/lighttpd.conf ]
then
    while read -r FILE; do
        sed -i -e 's/^server.modules.*mod_setenv.*/#\0/'  "$FILE"
        sed -i -e 's/^server.stat-cache-engine.*disable.*/#\0/'  "$FILE"
    done < <(find /etc/lighttpd/conf-available/* | grep -v dump1090-fa | grep -v readsb)

    # add mod_setenv to lighttpd modules, check if it's one too much
    echo 'server.modules += ( "mod_setenv" )' > /etc/lighttpd/conf-available/87-mod_setenv.conf
    echo 'server.stat-cache-engine = "disable"' > /etc/lighttpd/conf-available/47-stat-cache.conf

    ln -s -f /etc/lighttpd/conf-available/87-mod_setenv.conf /etc/lighttpd/conf-enabled/87-mod_setenv.conf
    ln -s -f /etc/lighttpd/conf-available/47-stat-cache.conf /etc/lighttpd/conf-enabled/47-stat-cache.conf
    #lighttpd -tt -f /etc/lighttpd/lighttpd.conf && echo success || true
    if lighttpd -tt -f /etc/lighttpd/lighttpd.conf 2>&1 | grep mod_setenv >/dev/null
    then
        rm /etc/lighttpd/conf-enabled/87-mod_setenv.conf
    fi

    #lighttpd -tt -f /etc/lighttpd/lighttpd.conf && echo success || true
    if lighttpd -tt -f /etc/lighttpd/lighttpd.conf 2>&1 | grep stat-cache >/dev/null
    then
        rm /etc/lighttpd/conf-enabled/47-stat-cache.conf
    fi

    #lighttpd -tt -f /etc/lighttpd/lighttpd.conf && echo success || true
    if lighttpd -tt -f /etc/lighttpd/lighttpd.conf 2>&1 | grep mod_setenv >/dev/null
    then
        rm /etc/lighttpd/conf-enabled/87-mod_setenv.conf
    fi
    #lighttpd -tt -f /etc/lighttpd/lighttpd.conf && echo success || true
fi

if systemctl status lighttpd &>/dev/null; then
    echo "Restarting lighttpd ..."
    systemctl restart lighttpd
fi

echo --------------


if [[ $nginx == yes ]]; then
    echo
    echo "To configure nginx for tar1090, please add the following line(s) in the server {} section:"
    echo
    for service in $services; do
        echo "include /usr/local/share/tar1090/nginx-$service.conf;"
    done
fi

echo --------------

if [[ $lighttpd == yes ]]; then
    for name in $names; do
        echo "All done! Webinterface available at http://$(ip route get 1.2.3.4 | grep -m1 -o -P 'src \K[0-9,.]*')/$name"
    done
elif [[ $nginx == yes ]]; then
    for name in $names; do
        echo "All done! Webinterface once nginx is configured will be available at http://$(ip route get 1.2.3.4 | grep -m1 -o -P 'src \K[0-9,.]*')/$name"
    done
else
    echo "All done! You'll need to configure your webserver yourself, see /usr/local/share/tar1090/nginx-tar1090.conf for a reference nginx configuration"
fi

