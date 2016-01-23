#!/usr/bin/perl

# http://perlmaven.com/getting-started-with-perl-dancer-on-digital-ocean

use warnings;
use strict;
use Daemon::Control;
 
use Cwd qw(abs_path);
 
Daemon::Control->new(
    {
        name      => "UserManager",
        lsb_start => '$syslog $remote_fs',
        lsb_stop  => '$syslog',
        lsb_sdesc => 'UserManager',
        lsb_desc  => 'UserManager',
        path      => abs_path($0),
 
        program      => '/usr/bin/starman',
        program_args => [ '--workers', '3', '--port', '5001', '/home/starman/UserManager/bin/app.psgi' ],
 
        user  => 'starman',
        group => 'starman',
 
        pid_file    => '/tmp/UserManager.pid',
        stderr_file => '/tmp/UserManager.err',
        stdout_file => '/tmp/UserManager.out',
 
        fork => 2,
    }
)->run;
