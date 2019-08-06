#!/bin/bash
echo --------------
echo "Removing tar1090!"
echo --------------

systemctl stop tar1090
systemctl disable tar1090

rm -rf /usr/local/share/tar1090

rm -f /etc/default/tar1090
rm -f /lib/systemd/system/tar1090.service

rm -f /etc/lighttpd/conf-available/88-tar1090.conf
rm -f /etc/lighttpd/conf-enabled/88-tar1090.conf


systemctl daemon-reload
systemctl restart lighttpd



echo --------------
echo "tar1090 is now gone! Shoo shoo!"
