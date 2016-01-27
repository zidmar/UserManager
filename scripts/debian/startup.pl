#!/usr/bin/env perl
## Inspired by:
## http://perlmaven.com/getting-started-with-perl-dancer-on-digital-ocean

use warnings;
use strict;
use Daemon::Control;
use Cwd qw(abs_path);

###############################################################################

## Set application name and proxy port

my $application = "UserManager";
my $proxy_port  = "5001";


###############################################################################
 
Daemon::Control->new(
    {
        name      => $application,
        lsb_start => '$syslog $remote_fs',
        lsb_stop  => '$syslog',
        lsb_sdesc => $application,
        lsb_desc  => $application,
        path      => abs_path($0),
 
        program      => "/usr/bin/starman",
        program_args => [ "--workers", "3", "--port", $proxy_port, "/home/starman/$application/bin/app.psgi" ],
 
        user  => "starman",
        group => "starman",
 
        pid_file    => "/tmp/$application.pid",
        stderr_file => "/tmp/$application.err",
        stdout_file => "/tmp/$application.out",
 
        fork => 2,
    }
)->run;
