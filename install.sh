#!/bin/bash

ipath=/usr/local/share/tar1090
install=0

packages="lighttpd unzip"

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
	apt-get upgrade -y
	if ! apt-get install -y $packages
	then
		echo "Failed to install required packages: $packages"
		echo "Exiting ..."
		exit 1
	fi
fi

if [ -z $1 ] || [ $1 != "test" ]
then
	cd /tmp
	if ! wget --timeout=30 -q -O master.zip https://github.com/wiedehopf/tar1090/archive/master.zip || ! unzip -q -o master.zip
	then
		echo "Unable to download files, exiting! (Maybe try again?)"
		exit 1
	fi
	cd tar1090-master
fi

if [[ -n $1 ]] && [ $1 != "test" ] ; then
	sed -i -e "s?/run/dump1090-fa?$1?" 88-tar1090.conf
	sed -i -e "s?/run/dump1090-fa?$1?" tar1090.sh
fi



mkdir -p $ipath

if [ -f $ipath/defaults.json ]; then
	cp $ipath/config.json . 2>/dev/null
fi

cp -r * $ipath

cp -n default /etc/default/tar1090
cp tar1090.service /lib/systemd/system


cp 88-tar1090.conf /etc/lighttpd/conf-available
lighty-enable-mod tar1090 >/dev/null

if grep -q '^server.modules += ( "mod_setenv" )' /etc/lighttpd/conf-available/89-dump1090-fa.conf
then
	sed -i -e 's/^server.modules += ( "mod_setenv" )/#server.modules += ( "mod_setenv" )/'  $(find /etc/lighttpd/conf-available/* | grep -v dump1090-fa)
fi

systemctl daemon-reload
systemctl enable tar1090 &>/dev/null
systemctl restart tar1090 lighttpd



echo --------------
echo "All done!"
