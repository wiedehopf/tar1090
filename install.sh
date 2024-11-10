#!/bin/bash
# shellcheck shell=bash disable=SC2016
umask 022


set -e
trap 'echo "[ERROR] Error in line $LINENO when executing: $BASH_COMMAND"' ERR
renice 10 $$

srcdir=/run/readsb
repo="https://github.com/wiedehopf/tar1090"
db_repo="https://github.com/wiedehopf/tar1090-db"

# optional command line options for this install script
# $1: data source directory
# $2: web path, default is "tar1090", use "webroot" to place the install at /
# $3: specify install path
# $4: specify git path as source instead of pulling from git

ipath=/usr/local/share/tar1090
if [[ -n "$3" ]]; then ipath="$3"; fi

if [[ -n "$4" ]] && grep -qs -e 'tar1090' "$4/install.sh"; then git_source="$4"; fi

lighttpd=no
nginx=no
function useSystemd () { command -v systemctl &>/dev/null; }

gpath="$TAR1090_UPDATE_DIR"
if [[ -z "$gpath" ]]; then gpath="$ipath"; fi

mkdir -p "$ipath"
mkdir -p "$gpath"

if useSystemd && ! id -u tar1090 &>/dev/null
then
    adduser --system --home "$ipath" --no-create-home --quiet tar1090 || adduser --system --home-dir "$ipath" --no-create-home tar1090
fi

# terminate with /
command_package="git git/jq jq/curl curl"
packages=()

while read -r -d '/' CMD PKG
do
    if ! command -v "$CMD" &>/dev/null
    then
        #echo "command $CMD not found, will try to install package $PKG"
        packages+=("$PKG")
    fi
done < <(echo "$command_package")

if [[ -n "${packages[*]}" ]]; then
    if ! command -v "apt-get" &>/dev/null; then
        echo "Please install the following packages and rerun the install:"
        echo "${packages[*]}"
        exit 1
    fi
    echo "Installing required packages: ${packages[*]}"
    if ! apt-get install -y --no-install-suggests --no-install-recommends "${packages[@]}"; then
        apt-get update || true
        apt-get install -y --no-install-suggests --no-install-recommends "${packages[@]}" || true
    fi
    hash -r || true
    while read -r -d '/' CMD PKG
    do
        if ! command -v "$CMD" &>/dev/null
        then
            echo "command $CMD not found, seems we failed to install package $PKG"
            echo "FATAL: Exiting!"
            exit 1
        fi
    done < <(echo "$command_package")
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

if (( $( { du -s "$gpath/git-db" 2>/dev/null || echo 0; } | cut -f1) > 150000 )); then
    rm -rf "$gpath/git-db"
fi

function copyNoClobber() {
    if ! [[ -f "$2" ]]; then
        cp "$1" "$2"
    fi
}

function getGIT() {
    # getGIT $REPO $BRANCH $TARGET (directory)
    if [[ -z "$1" ]] || [[ -z "$2" ]] || [[ -z "$3" ]]; then echo "getGIT wrong usage, check your script or tell the author!" 1>&2; return 1; fi
    REPO="$1"; BRANCH="$2"; TARGET="$3"; pushd . >/dev/null
    if cd "$TARGET" &>/dev/null && git fetch --depth 1 origin "$BRANCH" 2>/dev/null && git reset --hard FETCH_HEAD; then popd >/dev/null && return 0; fi
    if ! cd /tmp || ! rm -rf "$TARGET"; then popd > /dev/null; return 1; fi
    if git clone --depth 1 --single-branch --branch "$BRANCH" "$REPO" "$TARGET"; then popd > /dev/null; return 0; fi
    rm -rf "$TARGET"; tmp=/tmp/getGIT-tmp-tar1090
    if wget -O "$tmp" "$REPO/archive/refs/heads/$BRANCH.zip" && unzip "$tmp" -d "$tmp.folder" >/dev/null; then
        if mv -fT "$tmp.folder/$(ls "$tmp.folder")" "$TARGET"; then rm -rf "$tmp" "$tmp.folder"; popd > /dev/null; return 0; fi
    fi
    rm -rf "$tmp" "$tmp.folder"; popd > /dev/null; return 1;
}
function revision() {
    git rev-parse --short HEAD 2>/dev/null || echo "$RANDOM-$RANDOM"
}

if ! { [[ "$1" == "test" ]] && cd "$gpath/git-db"; }; then
    DB_VERSION_NEW=$(curl --silent --show-error "https://raw.githubusercontent.com/wiedehopf/tar1090-db/master/version")
    if  [[ "$(cat "$gpath/git-db/version" 2>/dev/null)" != "$DB_VERSION_NEW" ]]; then
        getGIT "$db_repo" "master" "$gpath/git-db" || true
    fi
fi

if ! cd "$gpath/git-db"
then
    echo "Unable to download files, exiting! (Maybe try again?)"
    exit 1
fi

DB_VERSION=$(revision)

cd "$dir"

if [[ "$1" == "test" ]] || [[ -n "$git_source" ]]; then
    mkdir -p "$gpath/git"
    rm -rf "$gpath/git"/* || true
    if [[ -n "$git_source" ]]; then
        cp -r "$git_source"/* "$gpath/git"
    else
        cp -r ./* "$gpath/git"
    fi
    cd "$gpath/git"
    TAR_VERSION="$(cat version)_dirty"
else
    VERSION_NEW=$(curl --silent --show-error "https://raw.githubusercontent.com/wiedehopf/tar1090/master/version")
    if  [[ "$(cat "$gpath/git/version" 2>/dev/null)" != "$VERSION_NEW" ]]; then
        if ! getGIT "$repo" "master" "$gpath/git"; then
            echo "Unable to download files, exiting! (Maybe try again?)"
            exit 1
        fi
    fi
    if ! cd "$gpath/git"; then
        echo "Unable to download files, exiting! (Maybe try again?)"
        exit 1
    fi
    TAR_VERSION="$(cat version)"
fi


if [[ -n $1 ]] && [ "$1" != "test" ] ; then
    srcdir=$1
elif [ -f /etc/default/tar1090_instances ]; then
    true
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
elif [[ -f /run/shm/aircraft.json ]]; then
    srcdir=/run/shm
else
    echo --------------
    echo FATAL: could not find aircraft.json in any of the usual places!
    echo "checked these: /run/readsb /run/dump1090-fa /run/dump1090 /run/dump1090-mutability /run/adsbexchange-feed /run/skyaware978"
    echo --------------
    echo "You need to have a decoder installed first, readsb is recommended:"
    echo "https://github.com/wiedehopf/adsb-scripts/wiki/Automatic-installation-for-readsb"
    echo --------------
    exit 1
fi

if [[ -n $2 ]]; then
    instances="$srcdir $2"
elif [[ -n $1 ]] && [ "$1" != "test" ] ; then
    instances="$1 tar1090"
elif [ -f /etc/default/tar1090_instances ]; then
    instances=$(</etc/default/tar1090_instances)	
else
    instances="$srcdir tar1090"
fi

if [[ -d /usr/local/share/adsbexchange-978 ]]; then
    instances+="\n /run/adsbexchange-978 ax978"
fi

instances=$(echo -e "$instances" | grep -v -e '^#')


if ! diff tar1090.sh "$ipath"/tar1090.sh &>/dev/null; then
    changed=yes
    while read -r srcdir instance; do
        if [[ -z "$srcdir" || -z "$instance" ]]; then
            continue
        fi

        if [[ "$instance" != "tar1090" ]]; then
            service="tar1090-$instance"
        else
            service="tar1090"
        fi
        if useSystemd; then
            systemctl stop "$service" 2>/dev/null || true
        fi
    done < <(echo "$instances")
    rm -f "$ipath"/tar1090.sh
    cp tar1090.sh "$ipath"
fi


# copy over base files
cp install.sh uninstall.sh getupintheair.sh LICENSE README.md "$ipath"
cp default "$ipath/example_config_dont_edit"
cp html/config.js "$ipath/example_config.js"
rm -f "$ipath/default"

# create 95-tar1090-otherport.conf
{
    echo '# serve tar1090 directly on port 8504'
    echo '$SERVER["socket"] == ":8504" {'
    cat 88-tar1090.conf
    echo '}'
} > 95-tar1090-otherport.conf

services=()
names=""
otherport=""

while read -r srcdir instance
do
    if [[ -z "$srcdir" || -z "$instance" ]]; then
        continue
    fi
    TMP="$ipath/.instance_tmp"
    rm -rf "$TMP"
    mkdir -p "$TMP"
    chmod 755 "$TMP"

    if [[ "$instance" != "tar1090" ]]; then
        html_path="$ipath/html-$instance"
        service="tar1090-$instance"
    else
        html_path="$ipath/html"
        service="tar1090"
    fi
    services+=("$service")
    names+="$instance "

    # don't overwrite existing configuration
    useSystemd && copyNoClobber default /etc/default/"$service"

    sed -i.orig -e "s?SOURCE_DIR?$srcdir?g" -e "s?SERVICE?${service}?g" \
        -e "s?/INSTANCE??g" -e "s?HTMLPATH?$html_path?g" 95-tar1090-otherport.conf

    if [[ "$instance" == "webroot" ]]; then
        sed -i.orig -e "s?SOURCE_DIR?$srcdir?g" -e "s?SERVICE?${service}?g" \
            -e "s?/INSTANCE??g" -e "s?HTMLPATH?$html_path?g" 88-tar1090.conf
        sed -i.orig -e "s?SOURCE_DIR?$srcdir?g" -e "s?SERVICE?${service}?g" \
            -e "s?/INSTANCE/?/?g" -e "s?HTMLPATH?$html_path?g" nginx.conf
        sed -i -e "s?/INSTANCE?/?g" nginx.conf
    else
        sed -i.orig -e "s?SOURCE_DIR?$srcdir?g" -e "s?SERVICE?${service}?g" \
            -e "s?INSTANCE?$instance?g" -e "s?HTMLPATH?$html_path?g" 88-tar1090.conf
        sed -i.orig -e "s?SOURCE_DIR?$srcdir?g" -e "s?SERVICE?${service}?g" \
            -e "s?INSTANCE?$instance?g" -e "s?HTMLPATH?$html_path?g" nginx.conf
    fi

    if [[ $lighttpd == yes ]] && lighttpd -v | grep -E 'lighttpd/1.4.(5[6-9]|[6-9])' -qs; then
        sed -i -e 's/compress.filetype/deflate.mimetypes/' 88-tar1090.conf
        sed -i -e 's/compress.filetype/deflate.mimetypes/' 95-tar1090-otherport.conf
        if ! grep -qs -e '^[^#]*"mod_deflate"' /etc/lighttpd/lighttpd.conf /etc/lighttpd/conf-enabled/*; then
            sed -i -e 's/^[^#]*deflate.mimetypes/#\0/' 88-tar1090.conf
            sed -i -e 's/^[^#]*deflate.mimetypes/#\0/' 95-tar1090-otherport.conf
        fi
    fi


    sed -i.orig -e "s?SOURCE_DIR?$srcdir?g" -e "s?SERVICE?${service}?g" tar1090.service

    cp -r -T html "$TMP"
    cp -r -T "$gpath/git-db/db" "$TMP/db-$DB_VERSION"
    sed -i -e "s/let databaseFolder = .*;/let databaseFolder = \"db-$DB_VERSION\";/" "$TMP/index.html"
    echo "{ \"tar1090Version\": \"$TAR_VERSION\", \"databaseVersion\": \"$DB_VERSION\" }" > "$TMP/version.json"

    # keep some stuff around
    mv "$html_path/config.js" "$TMP/config.js" 2>/dev/null || true
    mv "$html_path/upintheair.json" "$TMP/upintheair.json" 2>/dev/null || true

    # in case we have offlinemaps installed, modify config.js
    MAX_OFFLINE=""
    for i in {0..15}; do
        if [[ -d /usr/local/share/osm_tiles_offline/$i ]]; then
            MAX_OFFLINE=$i
        fi
    done
    if [[ -n "$MAX_OFFLINE" ]]; then
        if ! grep "$TMP/config.js" -e '^offlineMapDetail.*' -qs &>/dev/null; then
            echo "offlineMapDetail=$MAX_OFFLINE;" >> "$TMP/config.js"
        else
            sed -i -e "s/^offlineMapDetail.*/offlineMapDetail=$MAX_OFFLINE;/" "$TMP/config.js"
        fi
    fi

    cp "$ipath/customIcon.png" "$TMP/images/tar1090-favicon.png" &>/dev/null || true

    # bust cache for all css and js files

    dir=$(pwd)
    cd "$TMP"

    sed -i -e "s/tar1090 on github/tar1090 on github (${TAR_VERSION})/" index.html

    "$gpath/git/cachebust.sh" "$gpath/git/cachebust.list" "$TMP"

    rm -rf "$html_path"
    mv "$TMP" "$html_path"

    cd "$dir"

    cp nginx.conf "$ipath/nginx-${service}.conf"

    if [[ $lighttpd == yes ]]; then
        # clean up broken symlinks in conf-enabled ...
        for link in /etc/lighttpd/conf-enabled/*; do [[ -e "$link" ]] || rm -f "$link"; done
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
            cp 88-tar1090.conf /etc/lighttpd/conf-available/99-"${service}".conf
            ln -f -s /etc/lighttpd/conf-available/99-"${service}".conf /etc/lighttpd/conf-enabled/99-"${service}".conf
        else
            cp 88-tar1090.conf /etc/lighttpd/conf-available/88-"${service}".conf
            ln -f -s /etc/lighttpd/conf-available/88-"${service}".conf /etc/lighttpd/conf-enabled/88-"${service}".conf
            if [ -f /etc/lighttpd/conf.d/69-skybup.conf ]; then
                mv /etc/lighttpd/conf-enabled/88-"${service}".conf /etc/lighttpd/conf-enabled/66-"${service}".conf
            fi
        fi
    fi

    if useSystemd; then
        if [[ $changed == yes ]] || ! diff tar1090.service /lib/systemd/system/"${service}".service &>/dev/null
        then
            cp tar1090.service /lib/systemd/system/"${service}".service
            if systemctl enable "${service}"
            then
                echo "Restarting ${service} ..."
                systemctl restart "$service" || ! pgrep systemd
            else
                echo "${service}.service is masked, could not start it!"
            fi
        fi
    fi

    # restore sed modified configuration files
    mv 88-tar1090.conf.orig 88-tar1090.conf
    mv 95-tar1090-otherport.conf.orig 95-tar1090-otherport.conf
    mv nginx.conf.orig nginx.conf
    mv tar1090.service.orig tar1090.service
done < <(echo "$instances")

if [[ $lighttpd == yes ]]; then
    if lighttpd -tt -f /etc/lighttpd/lighttpd.conf 2>&1 | grep -i duplicate >/dev/null; then
        mv -f /etc/lighttpd/conf-available/89-dump1090-fa.conf.dpkg-dist /etc/lighttpd/conf-available/89-dump1090-fa.conf &>/dev/null || true
    fi

    if ! grep -qs -E -e '^[^#]*"mod_alias"' /etc/lighttpd/lighttpd.conf /etc/lighttp/conf-enabled/* /etc/lighttpd/external.conf; then
        echo 'server.modules += ( "mod_alias" )' > /etc/lighttpd/conf-available/07-mod_alias.conf
        ln -s -f /etc/lighttpd/conf-available/07-mod_alias.conf /etc/lighttpd/conf-enabled/07-mod_alias.conf
    else
        rm -f /etc/lighttpd/conf-enabled/07-mod_alias.conf
    fi

    rm -f /etc/lighttpd/conf-available/87-mod_setenv.conf /etc/lighttpd/conf-enabled/87-mod_setenv.conf
    while read -r FILE; do
        sed -i -e 's/^server.modules.*mod_setenv.*/#\0/'  "$FILE"
        sed -i -e 's/^server.stat-cache-engine.*disable.*/#\0/'  "$FILE"
    done < <(find /etc/lighttpd/conf-available/* | grep -v setenv)

    # add mod_setenv to lighttpd modules, check if it's one too much
    echo 'server.modules += ( "mod_setenv" )' > /etc/lighttpd/conf-available/07-mod_setenv.conf
    echo 'server.stat-cache-engine = "disable"' > /etc/lighttpd/conf-available/47-stat-cache.conf

    ln -s -f /etc/lighttpd/conf-available/07-mod_setenv.conf /etc/lighttpd/conf-enabled/07-mod_setenv.conf
    ln -s -f /etc/lighttpd/conf-available/47-stat-cache.conf /etc/lighttpd/conf-enabled/47-stat-cache.conf

    if (( $(cat /etc/lighttpd/conf-enabled/* | grep -c -E -e '^server.stat-cache-engine *\= *"disable")') > 1 )); then
        rm -f /etc/lighttpd/conf-enabled/47-stat-cache.conf
    fi
    if (( $(cat /etc/lighttpd/conf-enabled/* | grep -c -E -e '^server.modules.?\+=.?\(.?"mod_setenv".?\)') > 1 )); then
        rm -f /etc/lighttpd/conf-available/07-mod_setenv.conf /etc/lighttpd/conf-enabled/07-mod_setenv.conf
    fi

    if lighttpd -tt -f /etc/lighttpd/lighttpd.conf 2>&1 | grep mod_setenv >/dev/null; then
        rm -f /etc/lighttpd/conf-available/07-mod_setenv.conf /etc/lighttpd/conf-enabled/07-mod_setenv.conf
    fi
    if lighttpd -tt -f /etc/lighttpd/lighttpd.conf 2>&1 | grep stat-cache >/dev/null; then
        rm -f /etc/lighttpd/conf-enabled/47-stat-cache.conf
    fi

    #lighttpd -tt -f /etc/lighttpd/lighttpd.conf && echo success || true
    if lighttpd -tt -f /etc/lighttpd/lighttpd.conf 2>&1 | grep mod_setenv >/dev/null
    then
        rm -f /etc/lighttpd/conf-available/07-mod_setenv.conf /etc/lighttpd/conf-enabled/07-mod_setenv.conf
    fi
    #lighttpd -tt -f /etc/lighttpd/lighttpd.conf && echo success || true
    if ! lighttpd -tt -f /etc/lighttpd/lighttpd.conf &>/dev/null; then
        echo ----------------
        echo "Lighttpd error, tar1090 will probably not work correctly:"
        lighttpd -tt -f /etc/lighttpd/lighttpd.conf
    fi

    if grep -qs -e '^compress.cache-dir' /etc/lighttpd/lighttpd.conf; then
        echo -----
        echo "Disabling compress.cache-dir in /etc/lighttpd/lighttpd.conf due to often causing full disk issues as there is no automatic cleanup mechanism. Add a leading space to the compress.cache-dir line if you don't want tar1090 to mess with it in the future."
        echo -----
        sed -i -e 's$^compress.cache-dir.*$#\0 # disabled by tar1090, often causes full disk due to not having a cleanup mechanism$' /etc/lighttpd/lighttpd.conf
    elif ! grep -qs -e 'disabled by tar1090' /etc/lighttpd/lighttpd.conf; then
        sed -i -e 's$^compress.cache-dir.*$# CAUTION, enabling cache-dir and filetype json will cause full disk when using tar1090\n\0$' /etc/lighttpd/lighttpd.conf
    fi
    if grep -qs -e '^deflate.cache-dir' /etc/lighttpd/lighttpd.conf; then
        echo -----
        echo "Disabling deflate.cache-dir in /etc/lighttpd/lighttpd.conf due to often causing full disk issues as there is no automatic cleanup mechanism. Add a leading space to the deflate.cache-dir line if you don't want tar1090 to mess with it in the future."
        echo -----
        sed -i -e 's$^deflate.cache-dir.*$#\0 # disabled by tar1090, often causes full disk due to not having a cleanup mechanism$' /etc/lighttpd/lighttpd.conf
    elif ! grep -qs -e 'disabled by tar1090' /etc/lighttpd/lighttpd.conf; then
        sed -i -e 's$^deflate.cache-dir.*$# CAUTION, enabling cache-dir and filetype json will cause full disk when using tar1090\n\0$' /etc/lighttpd/lighttpd.conf
    fi
fi

if useSystemd && systemctl show lighttpd 2>/dev/null | grep -qs -F -e 'UnitFileState=enabled' -e 'ActiveState=active'; then
    echo "Restarting lighttpd ..."
    systemctl restart lighttpd || ! pgrep systemd
fi

echo --------------


if [[ $nginx == yes ]]; then
    echo
    echo "To configure nginx for tar1090, please add the following line(s) in the server {} section:"
    echo
    for service in "${services[@]}"; do
        echo "include ${ipath}/nginx-${service}.conf;"
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
    echo "All done! You'll need to configure your webserver yourself, see ${ipath}/nginx-tar1090.conf for a reference nginx configuration"
fi

