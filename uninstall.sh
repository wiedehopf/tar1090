#!/bin/bash

instance=tar1090
echo --------------
if [[ -n $1 ]]; then
	instance="tar1090-$1"
    rm -rf "/usr/local/share/tar1090/html-$1"
    echo "Removing tar1090, instance name $instance!"
else
    echo "Removing tar1090, all instances!"
	rm -rf /usr/local/share/tar1090
    rm -f /etc/lighttpd/conf-available/*tar1090*
    rm -f /etc/lighttpd/conf-enabled/*tar1090*
fi
echo --------------

systemctl stop "$instance"
systemctl disable "$instance"

#rm -f /etc/default/$instance
echo "Configuration is left to be removed manually, you can use this command:"
echo "sudo rm /etc/default/$instance"
rm -f "/lib/systemd/system/$instance.service"

rm -f "/etc/lighttpd/conf-available/88-$instance.conf"
rm -f "/etc/lighttpd/conf-enabled/88-$instance.conf"
rm -f "/etc/lighttpd/conf-available/99-$instance-webroot.conf"
rm -f "/etc/lighttpd/conf-enabled/99-$instance-webroot.conf"


systemctl daemon-reload
systemctl restart lighttpd



echo --------------
echo "tar1090 is now gone! Shoo shoo!"
