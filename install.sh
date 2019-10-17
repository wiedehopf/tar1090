#!/bin/bash
# avoid changes to this bash script affecting the running script

set -e

instance=tar1090
srcdir=/run/dump1090-fa
repo="https://github.com/wiedehopf/tar1090"
ipath=/usr/local/share/tar1090
html_path="$ipath/html"
install=0
lighttpd=no
nginx=no

packages="unzip git p7zip-full perl jq"

for i in $packages
do
	if ! dpkg -s $i 2>/dev/null | grep 'Status.*installed' &>/dev/null
	then
		install=1
	fi
done

if [ $install == 1 ]
then
	echo "Installing required packages: $packages"
	apt-get update
	if ! apt-get install -y $packages
	then
		echo "Failed to install required packages: $packages"
		echo "Exiting ..."
		exit 1
	fi
	hash -r
fi

if dpkg -s lighttpd 2>/dev/null | grep 'Status.*installed' &>/dev/null
then
	lighttpd=yes
fi

if dpkg -s nginx 2>/dev/null | grep 'Status.*installed' &>/dev/null
then
	nginx=yes
fi


mkdir -p $ipath

if [ -z $1 ] || [ $1 != "test" ]
then
	cd /tmp
	if git clone --depth 1 $repo $ipath/git 2>/dev/null || cd $ipath/git; then
		cd $ipath/git
		git checkout -f master
		git fetch
		git reset --hard origin/master
	else
		cd /tmp
		if ! wget --timeout=30 -q -O master.zip $repo/archive/master.zip || ! unzip -q -o master.zip
		then
			echo "Unable to download files, exiting! (Maybe try again?)"
			exit 1
		fi
		cd tar1090-master
	fi
fi

if [[ -n $1 ]] && [ $1 != "test" ] ; then
	srcdir=$1
elif ! [[ -d /run/dump1090-fa ]] ; then
	if [[ -d /run/dump1090 ]]; then
		srcdir=/run/dump1090
	elif [[ -d /run/dump1090-mutability ]]; then
		srcdir=/run/dump1090-mutability
	elif [[ -d /run/readsb ]]; then
		srcdir=/run/readsb
	elif [[ -d /run/skyaware978 ]]; then
		srcdir=/run/skyaware978
	fi
fi

if [[ -n $2 ]]; then
	instance=$2
	html_path="$ipath/$instance-html"
fi


sed -i -e "s?SOURCE_DIR?$srcdir?g" -e "s?INSTANCE?$instance?g" -e "s?HTMLPATH?$html_path?g" 88-tar1090.conf
sed -i -e "s?SOURCE_DIR?$srcdir?g" -e "s?INSTANCE?$instance?g" -e "s?HTMLPATH?$html_path?g" nginx.conf
sed -i -e "s?SOURCE_DIR?$srcdir?g" -e "s?INSTANCE?$instance?g" tar1090.service




if ! diff tar1090.sh /usr/local/share/tar1090/tar1090.sh &>/dev/null \
	|| ! diff tar1090.service /lib/systemd/system/$instance.service &>/dev/null
then
	changed=yes
fi
if ! diff 88-tar1090.conf /etc/lighttpd/conf-enabled/88-$instance.conf &>/dev/null; then
	changed_lighttpd=yes
fi

# keep some stuff around
if [ -f $html_path/defaults.js ]; then
	cp $html_path/config.js /tmp/tar1090_config.js
fi
cp $html_path/colors.css html/ 2>/dev/null || true

cp -r -T html $html_path
cp 88-tar1090.conf default install.sh nginx.conf tar1090.service \
	uninstall.sh 99-tar1090-webroot.conf LICENSE README.md \
	tar1090.sh 95-tar1090-otherport.conf $ipath

mv /tmp/tar1090_config.js $html_path/config.js 2>/dev/null || true

# bust cache for all css and js files
sed -i -e "s/__cache_version__/$(date +%s)/g" $html_path/index.html

# don't overwrite existing configuration
cp -n default /etc/default/$instance
sed -i -e 's/skyview978/skyaware978/' /etc/default/$instance


cp nginx.conf $ipath/nginx-$instance.conf
if [[ $lighttpd == yes ]]; then
	cp 88-tar1090.conf /etc/lighttpd/conf-available/88-$instance.conf
	lighty-enable-mod $instance >/dev/null || true
	if grep -q '^server.modules += ( "mod_setenv" )' /etc/lighttpd/conf-available/89-dump1090-fa.conf
	then
		sed -i -e 's/^server.modules += ( "mod_setenv" )/#server.modules += ( "mod_setenv" )/'  $(find /etc/lighttpd/conf-available/* | grep -v dump1090-fa)
	fi
fi


if [[ $changed == yes ]]; then
	cp tar1090.service /lib/systemd/system/$instance.service
	systemctl enable $instance
	echo "Restarting tar1090 ..."
	systemctl restart $instance
fi
if [[ $changed_lighttpd == yes ]] && systemctl status lighttpd >/dev/null; then
	echo "Restarting lighttpd ..."
	systemctl restart lighttpd
fi

if [[ $nginx == yes ]]; then
	echo
	echo "To configure nginx for tar1090, please add the following line in the server {} section:"
	echo
	echo "include /usr/local/share/tar1090/nginx-$instance.conf;"
	echo
fi

echo --------------
echo "All done! Webinterface available at http://$(ip route | grep -m1 -o -P 'src \K[0-9,.]*')/$instance"
