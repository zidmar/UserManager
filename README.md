# UserManager

**UserManager** helps manage users and groups for the StuffTracker application.

#### Installation instructions for Debian found in [StuffTracker](https://github.com/zidmar/StuffTracker)

1.) Log in to the **starman** user

```sh
su - starman
```

2.) Download the program using git

```sh
git clone --recursive https://github.com/zidmar/UserManager
```

3.) Create the database for the program

```sh
sqlite3 /home/starman/db/UserManager.db < /home/starman/UserManager/sql/user_manager-sqlite.sql
```

4.) Test the program by starting a test web server, available at http://localhost:5001

```sh
cd /home/starman/UserManager
plackup -p 5001 bin/app.psgi
```

5.) After verifying the web app loads correctly, stop the test web server with **Ctrl-C**

##### Install the production web server configuration files:

1.) As the **root** user, copy web server configuration file

```sh
cp /home/starman/UserManager/scripts/debian/apache.conf /etc/apache2/conf-enabled/UserManager.conf
```

2.) Give execute permissions to the program startup script and create a logical link to start the program (as a service) at boot

```sh
chmod +x /home/starman/UserManager/scripts/debian/startup.pl

ln -s /home/starman/UserManager/scripts/debian/startup.pl /etc/init.d/UserManager
ln -s /home/starman/UserManager/scripts/debian/startup.pl /etc/rc0.d/K20UserManager
ln -s /home/starman/UserManager/scripts/debian/startup.pl /etc/rc1.d/K20UserManager
ln -s /home/starman/UserManager/scripts/debian/startup.pl /etc/rc2.d/S20UserManager
ln -s /home/starman/UserManager/scripts/debian/startup.pl /etc/rc3.d/S20UserManager
ln -s /home/starman/UserManager/scripts/debian/startup.pl /etc/rc4.d/S20UserManager
ln -s /home/starman/UserManager/scripts/debian/startup.pl /etc/rc5.d/S20UserManager
ln -s /home/starman/UserManager/scripts/debian/startup.pl /etc/rc6.d/K20UserManager

```

3.) Start the program as a service and the production web server

```sh
/etc/init.d/UserManager start
/etc/init.d/apache2 restart
```

4.) Access the website, using the production server, on http://localhost/UserManager

