#!/bin/bash
# avoid changes to this bash script affecting the running script
{

set -e

instance=tar1090
srcdir=/run/dump1090-fa
repo="https://github.com/wiedehopf/tar1090"
ipath=/usr/local/share/tar1090
install=0
lighttpd=no

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

if ! dpkg -s lighttpd 2>/dev/null | grep 'Status.*installed' &>/dev/null
then
	lighttpd=yes
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
fi


sed -i -e "s?INSTANCE?$instance?g" 88-tar1090.conf
sed -i -e "s?INSTANCE?$instance?g" tar1090.service

sed -i -e "s?SOURCE_DIR?$srcdir?g" 88-tar1090.conf
sed -i -e "s?SOURCE_DIR?$srcdir?g" tar1090.service



if ! diff tar1090.sh /usr/local/share/tar1090/tar1090.sh &>/dev/null \
	|| ! diff tar1090.service /lib/systemd/system/$instance.service &>/dev/null
then
	changed=yes
fi
if ! diff 88-tar1090.conf /etc/lighttpd/conf-available/88-$instance.conf &>/dev/null \
	|| ! diff 88-tar1090.conf /etc/lighttpd/conf-enabled/88-$instance.conf &>/dev/null
then
	changed_lighttpd=yes
fi

# keep some stuff around
if [ -f $ipath/html/defaults.js ]; then
	cp $ipath/html/config.js /tmp/tar1090_config.js
fi
cp $ipath/html/colors.css html/ 2>/dev/null

cp -r * $ipath

mv /tmp/tar1090_config.js $ipath/html/config.js 2>/dev/null

# bust cache for all css and js files
sed -i -e "s/__cache_version__/$(date +%s)/g" $ipath/html/index.html

# don't overwrite existing configuration
cp -n default /etc/default/$instance
sed -i -e 's/skyview978/skyaware978/' /etc/default/$instance


if [[ $lighttpd == yes ]]; then
	cp 88-tar1090.conf /etc/lighttpd/conf-available/88-$instance.conf
	lighty-enable-mod $instance >/dev/null
fi

if grep -q '^server.modules += ( "mod_setenv" )' /etc/lighttpd/conf-available/89-dump1090-fa.conf
then
	sed -i -e 's/^server.modules += ( "mod_setenv" )/#server.modules += ( "mod_setenv" )/'  $(find /etc/lighttpd/conf-available/* | grep -v dump1090-fa)
fi

if [[ $changed == yes ]]; then
	cp tar1090.service /lib/systemd/system/$instance.service
	systemctl daemon-reload
	echo "Restarting tar1090 ..."
	systemctl restart $instance
fi
if [[ $changed_lighttpd == yes ]] && systemctl status lighttpd >/dev/null; then
	echo "Restarting lighttpd ..."
	systemctl restart lighttpd
fi

if ! systemctl is-enabled $instance &>/dev/null; then
	systemctl enable $instance &>/dev/null
fi



echo --------------
echo "All done! Webinterface available at http://$(ip route | grep -m1 -o -P 'src \K[0-9,.]*')/$instance"
}
