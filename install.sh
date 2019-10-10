#!/bin/bash

repo="https://github.com/wiedehopf/tar1090"
ipath=/usr/local/share/tar1090
install=0

packages="lighttpd unzip git p7zip-full perl jq"

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

mkdir -p $ipath

if [ -z $1 ] || [ $1 != "test" ]
then
	cd /tmp
	git clone --depth 1 $repo $ipath/git 2>/dev/null
	cd $ipath/git
	git checkout -f master
	if ! git pull -f; then
		cd /tmp
		if ! wget --timeout=30 -q -O master.zip $repo/archive/master.zip || ! unzip -q -o master.zip
		then
			echo "Unable to download files, exiting! (Maybe try again?)"
			exit 1
		fi
		cd tar1090-master
	fi
fi

run_dir=/run/dump1090-fa

if [[ -n $1 ]] && [ $1 != "test" ] ; then
	run_dir=$1
elif ! [[ -d /run/dump1090-fa ]] ; then
	if [[ -d /run/dump1090 ]]; then
		run_dir=/run/dump1090
	elif [[ -d /run/dump1090-mutability ]]; then
		run_dir=/run/dump1090-mutability
	elif [[ -d /run/readsb ]]; then
		run_dir=/run/readsb
	elif [[ -d /run/skyaware978 ]]; then
		run_dir=/run/skyaware978
	fi
fi

sed -i -e "s?/run/dump1090-fa?$run_dir?" 88-tar1090.conf
sed -i -e "s?/run/dump1090-fa?$run_dir?" tar1090.sh



if [ -f $ipath/html/defaults.js ]; then
	cp $ipath/html/config.js /tmp/tar1090_config.js
fi
cp $ipath/html/colors.css html/ 2>/dev/null

! diff tar1090.sh /usr/local/share/tar1090/tar1090.sh &>/dev/null \
	|| ! diff tar1090.service /lib/systemd/system/tar1090.service &>/dev/null \
	|| ! diff 88-tar1090.conf /etc/lighttpd/conf-available/88-tar1090.conf &>/dev/null \
	|| ! diff 88-tar1090.conf /etc/lighttpd/conf-enabled/88-tar1090.conf &>/dev/null
changed=$?

rm -f $ipath/html/db/*.json
cp -r * $ipath

mv /tmp/tar1090_config.js $ipath/html/config.js 2>/dev/null

# bust cache for all css and js files
sed -i -e "s/__cache_version__/$(date +%s)/g" $ipath/html/index.html

cp -n default /etc/default/tar1090
sed -i -e 's/skyview978/skyaware978/' /etc/default/tar1090


cp 88-tar1090.conf /etc/lighttpd/conf-available
lighty-enable-mod tar1090 >/dev/null

if grep -q '^server.modules += ( "mod_setenv" )' /etc/lighttpd/conf-available/89-dump1090-fa.conf
then
	sed -i -e 's/^server.modules += ( "mod_setenv" )/#server.modules += ( "mod_setenv" )/'  $(find /etc/lighttpd/conf-available/* | grep -v dump1090-fa)
fi

if [ 0 -eq $changed ]; then
	cp tar1090.service /lib/systemd/system
	systemctl daemon-reload
	systemctl restart lighttpd
	systemctl restart tar1090
fi
if ! systemctl is-enabled tar1090 &>/dev/null; then
	systemctl enable tar1090 &>/dev/null
fi



echo --------------
echo "All done! Webinterface available at http://$(ip route | grep -m1 -o -P 'src \K[0-9,.]*')/tar1090"
