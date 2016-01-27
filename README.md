# UserManager

**UserManager** helps manage users and groups for the [StuffTracker](https://github.com/zidmar/StuffTracker) application.

#### Installation instructions for Debian. Some steps are not necesarry if [StuffTracker](https://github.com/zidmar/StuffTracker) was installed before.

1.) Install necessary packages as the root user

```sh
apt-get install git sqlite3 libdancer2-perl libdbi-perl libdbd-sqlite3-perl 
```

2.) Create the **starman** user where programs will reside

```sh
adduser --gecos '' --disabled-password starman
```

3.) Log in to the **starman** user

```sh
su - starman
```

4.) Download the program using git

```sh
git clone --recursive https://github.com/zidmar/UserManager
```

5.) Create a directory where the database files will reside

```sh
mkdir /home/starman/db
```

6.) Create the database for the program

```sh
sqlite3 /home/starman/db/UserManager.db < /home/starman/UserManager/sql/user_manager-sqlite.sql
```

7.) Test the program by starting a test web server, available at http://localhost:5001

```sh
cd /home/starman/UserManager
plackup -p 5001 bin/app.psgi
```

8.) After verifying the web app loads correctly, stop the test web server with **Ctrl-C**

##### Install the production web server:

1.) As **root** user, install the following packages

```sh
apt-get install apache2 libapache2-mod-proxy-html libxml2-dev libdaemon-control-perl starman
```

2.) Enable web server modules

```sh
a2enmod proxy proxy_http
```

3.) Copy web server configuration file

```sh
cp /home/starman/UserManager/scripts/debian/apache.conf /etc/apache2/conf-enabled/UserManager.conf
```

4.) Give execute permissions to the program startup script and create a logical link to start the program (as a service) at boot

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

5.) Start the program as a service and the production web server

```sh
/etc/init.d/UserManager start
/etc/init.d/apache2 restart
```

6.) Access the website, using the production server, on http://localhost/UserManager

