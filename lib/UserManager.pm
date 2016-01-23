package UserManager;
use Dancer2;

our $VERSION = '0.1';

###
## Modules
###

use DBI;
use Digest::MD5 qw(md5_hex);
use Data::Dumper;

###
## Database Variables
###

my $db_hash = {
    db         => config->{"db"},
    username   => config->{"db_username"},
    password   => config->{"db_password"},
    host       => config->{"db_host"},
    port       => config->{"db_port"},
    dbi_to_use => config->{"dbi_to_use"} 
};

###############################################################################
## Main
###############################################################################

hook 'before' => sub {
    if(!session('logged_in') && request->path_info !~ m{^/login}) {
        if(request->path_info eq '/change_password'){
        }
        elsif(request->path_info eq '/password_reset'){
        }
        else{
            return redirect '/login';
        }
    }
};

get '/' => sub {
    my $header_hash = request->headers;
    my $static_uri  = '';
    my $main_uri    = '';
    if($header_hash->{'x-forwarded-for'}){
        $static_uri = "/".config->{"appname"}."_static/";
        $main_uri   = '/'.config->{"appname"};
    }
    template 'index',{static_uri => $static_uri, main_uri => $main_uri, session_user => session->read('username') };
};

get '/user_manager/:rid?' => sub {

    my $header_hash = request->headers;
    my $hashref     = params;

    my $result = &user_manager({ content_range => $header_hash->{'x-range'}, params => $hashref });

    if(not defined(params->{rid})){
        header('Content-Range' => "$result->{content_range}/$result->{result_count}");
    }
    return $result->{json_output};
};

put '/user_manager/:id' => sub {
    my $body    = request->body;
    my $hashref = from_json($body);
    &modify_user($hashref);
};

post '/add' => sub {
    my $hashref = params;
    my $result  = &add_user($hashref);
    return $result;
};

post '/modify_password' => sub {
    my $hashref = params;
    my $result  = &modify_password($hashref);
    return $result;
};

## Admin ######################################################################

get '/admin_grid/:table_name' => sub {

    my $header_hash = request->headers;
    my $table_name  = params->{table_name};

    my $result = &admin_grid({ content_range => $header_hash->{'x-range'}, table_name => $table_name });
    header('Content-Range' => "$result->{content_range}/$result->{result_count}");
    return $result->{json_output};
};

put '/admin_grid/:table_name?/:second?' => sub {
    my $body    = request->body;
    my $hashref = from_json($body);
    $hashref->{table_name} = params->{table_name};
    &modify_admin($hashref);
};

post '/admin_add' => sub {
    my $hashref = params;
    my $result  = &admin_add($hashref);
    return $result;
};

## Selects ####################################################################

get '/filtering_select/:input/:rid?' => sub {

    my $input = param 'input';
    my $name  = params->{'name'} || undef;

    if($name){
        my $output = &filtering_select({ input => $input, name => $name });
        return $output->{json_output};
    }
    else{
        return "[]";
    }
};

## Login ######################################################################

any ['get', 'post'] => '/login' => sub {

    my $header_hash = request->headers;
    my $static_uri  = '';
    my $main_uri    = '';
    if($header_hash->{'x-forwarded-for'}){
        $static_uri = "/".config->{"appname"}."_static/";
        $main_uri   = '/'.config->{"appname"};
    }

    my $err = params->{'error_code'};

    if(request->method() eq "POST"){

        my $username = params->{'username'} || undef;
        my $password = params->{'password'} || undef;
        my $output   = {};

        if($username){
            if($password){
               $output = &_db_authen_processLogin({username => $username, password => $password});
            }
            else{
                $err = "Invalid password";
            }
        }
        else{
            $err = "Invalid username";
        }

        my $output_not_empty = undef;
        $output_not_empty    = (keys %$output)[-1];
        
        if($output_not_empty){
            if($output->{session_authorized} == 1){
                if($output->{session_admin} == 1){ ## only with Administrator privilege!!!
                    session->write('logged_in',          true);
                    session->write('username',           $output->{username});
                    session->write('uid',                $output->{uid});
                    session->write('full_name',          $output->{full_name});
                    session->write('session_admin',      $output->{session_admin});
                    session->write('session_authorized', $output->{session_authorized});
                    return redirect '/';
                }
                else{
                    debug("not admin");
                    $err = "User not authorized to use this page.";
                }
            }
            else{
                debug("authorized");
                $err = $output->{login_message};
            }
        }
    }
    template 'login', { 'err' => $err, static_uri => $static_uri, main_uri => $main_uri };
};

get '/logout' => sub {
    app->destroy_session;
    return redirect '/';
};

any ['get', 'post'] => '/change_password' => sub {

    my $header_hash = request->headers;
    my $static_uri  = '';
    my $main_uri    = '';
    if($header_hash->{'x-forwarded-for'}){
        $static_uri = "/".config->{"appname"}."_static/";
        $main_uri   = '/'.config->{"appname"};
    }

    my $err = params->{'error_code'};

    my $validation_id = params->{'validation_id'};

    ## for password recovery
    my $validate_hash = {}; 

    if($validation_id){
        $validate_hash = &_ldap_validateEmail({validation_id => $validation_id}); 
        if(!$validate_hash->{username}){
            $err = "Error - Not a Validation ID not found or invalid.";
        }
    }

    if(request->method() eq "POST"){
        
        my $param_hash = {};

        $param_hash->{username}      = params->{'username'};
        $param_hash->{password}      = params->{'password'};
        $param_hash->{npassword}     = params->{'npassword'};
        $param_hash->{cpassword}     = params->{'cpassword'};
        $param_hash->{validation_id} = $validation_id;

        if($validate_hash->{username}){
            $param_hash->{username} = $validate_hash->{username};
            $param_hash->{password} = "not_needed";
        }

        my $output = undef;

        if($param_hash->{username}){
            if($param_hash->{password}){
                if($param_hash->{npassword}){
                    if($param_hash->{cpassword}){
                        if($param_hash->{npassword} eq $param_hash->{cpassword}){
                            $output = &_db_change_password($param_hash);
                        }
                        else{
                            $err = "Error - New Password and Confirm New password does not match";
                        }
                    }
                    else{
                        $err = "Error - Confirm New password not entered";
                    }
                }
                else{
                    $err = "Error - New password not entered";
                }
            }
            else{
                $err = "Error - password not entered";
            }
        }
        else{
            $err = "Error - username not entered";
        }

        if($output){
            $err = $output;
        } 
    }
    template 'change_password', { 'err' => $err, 'username' => $validate_hash->{username},'validation_id' => $validation_id, static_uri => $static_uri, main_uri => $main_uri };
};

###############################################################################
## Subs
###############################################################################

sub user_manager {
    
    my ($sub_hash) = @_;
    
    my $content_range = $sub_hash->{content_range} || undef;
    my $params        = $sub_hash->{params};

    my $rid    = $params->{rid}    || undef;
    my $query  = $params->{query}  || undef;

    delete $params->{rid};
    delete $params->{query};

    my $dbh = &_db_handle($db_hash);
    my $sql = {};
    my $sth = {};

    ## Paging
    my $limit        = "100";
    my $offset       = "0";
    my $result_count = "";

    if( (defined($content_range)) && ($content_range =~ /items\=(\d+)\-(\d+)/) ){
        my $start  = $1;
        my $end    = $2;
        $offset    = $start;
        $content_range = "items " . $start . "-" . $end;
    }

    $sql->{1} = qq(select 
                    a.user_manager_id as id,
                    a.created,
                    a.updated,
                    a.username,
                    a.real_name,
                    a.status_to_user_manager_id as status_id,
                    b.description as status,
                    a.privilege_to_user_manager_id as privilege_id,
                    c.description as privilege,
                    a.department_to_user_manager_id as department_id,
                    d.description as department 
                   from
                    user_manager a,
                    status b,
                    privilege c,
                    department d
                   where
                    b.status_id = a.status_to_user_manager_id
                    and c.privilege_id = a.privilege_to_user_manager_id
                    and d.department_id = a.department_to_user_manager_id);

    $sql->{count} = qq(select 
                        count(a.user_manager_id)
                       from
                        user_manager a,
                        status b,
                        privilege c,
                        department d
                       where
                        b.status_id = a.status_to_user_manager_id
                        and c.privilege_id = a.privilege_to_user_manager_id
                        and d.department_id = a.department_to_user_manager_id);

    ## Search
    if($query){
            
        $query =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/eg;
            
        my $where_query = undef;
            
        if($query =~ /[\w\s\_\-]+/){
                
            $query = uc $query;
    
            $where_query  = qq{ 
                and (upper(a.username) like '%$query%'
                or upper(f.real_name) like '%$query%')
            };
        }
            
        if($where_query){
            $sql->{1}     .= $where_query;
            $sql->{count} .= $where_query;
        }
    }

    ## Filter/Sort
    my $sort_by          = undef;
    my $sort_order       = "asc";
    my $date_hash        = {};
    my $params_not_empty = undef;
    $params_not_empty    = (keys %$params)[-1];
    
    if($params_not_empty){
        for(keys %$params){
            if($_ =~ /^(\w+)\_id$/){
                my $column = $1 . "_to_user_manager_id";
                $sql->{1}     .= qq( and a.$column = $params->{$_} );
                $sql->{count} .= qq( and a.$column = $params->{$_} );
            }
            else{
                ## for Sort
                if($_ =~ /sort\((\-|\s+)(\w+)\)/){
                    $sort_by    = $2;
                    $sort_order = $1;
                    if($sort_order eq "-"){
                        $sort_order = "desc";
                    }
                }
                else{
                    if($_ =~ /date/){
                        #if($date_column{$_}){
                        if($_ =~ /(\w+)\_end$/){
                            $date_hash->{ $1 }->{ date_end } = $params->{$_};
                        }
                        else{
                            $date_hash->{ $_ }->{ date_start } = $params->{$_} ;
                        }
                    }
                    else{
                        $params->{$_} = uc $params->{$_};
                        $sql->{1}     .= qq( and upper(a.$_) like '%$params->{$_}%' );
                        $sql->{count} .= qq( and upper(a.$_) like '%$params->{$_}%' );
                    }
                }
            }
        }
    }

    ## Filter Dates
    my $date_hash_not_empty = undef;
    $date_hash_not_empty    = (keys %$date_hash)[-1];
    
    if($date_hash_not_empty){
        for(keys %$date_hash){
            $sql->{1}     .= " and a.$_ between '$date_hash->{$_}->{date_start}' and '$date_hash->{$_}->{date_end}' ";
            $sql->{count} .= " and a.$_ between '$date_hash->{$_}->{date_start}' and '$date_hash->{$_}->{date_end}' ";
        }
    }

    ## Specific
    if(defined($rid)){
        if($rid =~ /^\d+$/){
            $sql->{1} .= qq( and a.user_manager_id = $rid );
        }    
    }    

    if($sort_by){
        $sql->{1} .= qq( order by $sort_by $sort_order );
    }

    $sql->{1} .= " LIMIT $limit OFFSET $offset ";

    $sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
    $sth->{1}->execute() or error("Error in sth_1 execute");
    my $sql_1_result = $sth->{1}->fetchall_arrayref({});
    $sth->{1}->finish;

    if(not defined($rid)){
		$sth->{count} = $dbh->prepare($sql->{count}) or error("Error in sth_count");
		$sth->{count}->execute() or error("Error in sth_count");
		my $sql_count_result = $sth->{count}->fetchrow_arrayref;
		$sth->{count}->finish;
		$result_count = $sql_count_result->[0];
	}

    $dbh->disconnect;

    my $result_array = [];

    for my $row (@$sql_1_result){

        my $status = $row->{status_id} || 2;

        if($status == 1){
            $status = bless( do{\(my $o = 1)}, 'JSON::PP::Boolean' );
        }
        else{
            $status = bless( do{\(my $o = 0)}, 'JSON::PP::Boolean' );
        }

        push @$result_array, { id             => $row->{id}, 
                               created        => $row->{created},
                               updated        => $row->{created},
                               username       => $row->{username},
                               real_name      => $row->{real_name},
                               status_id      => $row->{status_id},
                               status         => $row->{status},
                               status_boolean => $status,
                               privilege_id   => $row->{privilege_id},
                               privilege      => $row->{privilege},
                               department_id  => $row->{department_id},
                               department     => $row->{department} };
    }

    if(defined($rid)){
        return ({ json_output => to_json($result_array, {utf8 => 0} ) });
    }
	else{
        return ({ json_output   => to_json($result_array, {utf8 => 0}),
                  content_range => $content_range,
                  result_count  => $result_count });
	}
}

sub add_user {

    my ($sub_hash) = @_;

    my $username   = $sub_hash->{username}   || undef;	
    my $password   = &_generate_password();	
    my $real_name  = $sub_hash->{real_name}  || $username;	
    my $department = $sub_hash->{department} || 1;	

    my $dbh = &_db_handle($db_hash);
    my $sth = {};
    my $sql = {};

    my $sub_output = "Error addding user. Username is empty!";

	if($username){

		$sub_output = "Error addding user. Username already exists!";

		$sql->{1} = qq(select user_manager_id from user_manager where username = ?);
		$sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
		$sth->{1}->execute($username) or error("Error in sth_1 execute");
		my $sql_1_result = $sth->{1}->fetchrow_hashref;

		if(!$sql_1_result->{user_manager_id}){

            $sql->{1} = "insert into user_manager (created,username,password,real_name,department_to_user_manager_id) values (" . &_now_to_use() . ",?,?,?,?)";
            $sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
            $sth->{1}->execute($username,$password,$real_name,$department) or error("Error in sth_1 execute");
            $sth->{1}->finish;

            my $last_id = $dbh->last_insert_id(undef,undef,"user_manager",undef) || undef;

            if($last_id){
                $sub_output = "Added entry successfully!";
            }
		}
		$dbh->disconnect;
	}
    return $sub_output;
}

sub modify_user {

    my ($sub_hash) = @_;

    my $dbh = &_db_handle($db_hash);
    my $sth = {};
    my $sql = {};

    ## username
    
    if(defined($sub_hash->{username})){ 

        $sql->{1} = qq(select user_manager_id as id from user_manager where username = ?);
        $sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
        $sth->{1}->execute($sub_hash->{username}) or error("Error in sth_1");
        my $sql_result_1 = $sth->{1}->fetchrow_hashref || {};
        $sth->{1}->finish;

        if(not defined($sql_result_1->{id})){

            $sql->{2} = qq(select username from user_manager where user_manager_id = ?);
            $sth->{2} = $dbh->prepare($sql->{2}) or error("Error in sth_2");
            $sth->{2}->execute($sub_hash->{id}) or error("Error in sth_2");
            my $sql_result_2 = $sth->{2}->fetchrow_hashref || {};
            $sth->{2}->finish;

            if($sql_result_2->{username}){
                if($sql_result_2->{username} ne $sub_hash->{username}){
                    $sql->{3} = "update user_manager set updated = " . &_now_to_use() . ",username = ? where user_manager_id = ?";
                    $sth->{3} = $dbh->prepare($sql->{3}) or error("Error in sth_3");
                    $sth->{3}->execute($sub_hash->{username},$sub_hash->{id}) or error("Error in sth_3");
                    $sth->{3}->finish;
                }
            }
        }
    }

    ## real name

    if(defined($sub_hash->{real_name})){

        $sql->{4} = qq(select real_name from user_manager where user_manager_id = ?);
        $sth->{4} = $dbh->prepare($sql->{4}) or error("Error in sth_4");
        $sth->{4}->execute($sub_hash->{id}) or error("Error in sth_4");
        my $sql_result_4 = $sth->{4}->fetchrow_hashref || {};
        $sth->{4}->finish;

        if($sql_result_4->{real_name}){
            if($sql_result_4->{real_name} ne $sub_hash->{real_name}){
                $sql->{5} = "update user_manager set updated = " . &_now_to_use() . ",real_name = ? where user_manager_id = ?";
                $sth->{5} = $dbh->prepare($sql->{5}) or error("Error in sth_5");
                $sth->{5}->execute($sub_hash->{real_name},$sub_hash->{id}) or error("Error in sth_5");
                $sth->{5}->finish;
            }
        }
    }

    ## privilege
    
    if(defined($sub_hash->{privilege})){

        $sql->{6} = qq(select privilege_id from privilege where description = ?);
        $sth->{6} = $dbh->prepare($sql->{6}) or error("Error in sth_6");
        $sth->{6}->execute($sub_hash->{privilege}) or error("Error in sth_6");
        my $sql_result_6 = $sth->{6}->fetchrow_hashref || {};
        $sth->{6}->finish;

        if($sql_result_6->{privilege_id}){

            $sql->{7} = qq(select privilege_to_user_manager_id from user_manager where user_manager_id = ?);
            $sth->{7} = $dbh->prepare($sql->{7}) or error("Error in sth_7");
            $sth->{7}->execute($sub_hash->{id}) or error("Error in sth_7");
            my $sql_result_7 = $sth->{7}->fetchrow_hashref || {};
            $sth->{7}->finish;

            if($sql_result_7->{privilege_to_user_manager_id}){
                if($sql_result_7->{privilege_to_user_manager_id} ne $sub_hash->{privilege}){
                    $sql->{8} = "update user_manager set updated = " . &_now_to_use() . ",privilege_to_user_manager_id = ? where user_manager_id = ?";
                    $sth->{8} = $dbh->prepare($sql->{8}) or error("Error in sth_8");
                    $sth->{8}->execute($sql_result_6->{privilege_id},$sub_hash->{id}) or error("Error in sth_8");
                    $sth->{8}->finish;
                }
            }
        }
    }

    ## department
    
    if(defined($sub_hash->{department})){

        $sql->{9} = qq(select department_id from department where description = ?);
        $sth->{9} = $dbh->prepare($sql->{9}) or error("Error in sth_9");
        $sth->{9}->execute($sub_hash->{department}) or error("Error in sth_9");
        my $sql_result_9 = $sth->{9}->fetchrow_hashref || {};
        $sth->{9}->finish;

        if($sql_result_9->{department_id}){

            $sql->{10} = qq(select department_to_user_manager_id from user_manager where user_manager_id = ?);
            $sth->{10} = $dbh->prepare($sql->{10}) or error("Error in sth_10");
            $sth->{10}->execute($sub_hash->{id}) or error("Error in sth_10");
            my $sql_result_10 = $sth->{10}->fetchrow_hashref || {};
            $sth->{10}->finish;

            if($sql_result_10->{department_to_user_manager_id}){
                if($sql_result_10->{department_to_user_manager_id} ne $sub_hash->{department}){
                    $sql->{11} = "update user_manager set updated = " . &_now_to_use() . ",department_to_user_manager_id = ? where user_manager_id = ?";
                    $sth->{11} = $dbh->prepare($sql->{11}) or error("Error in sth_11");
                    $sth->{11}->execute($sql_result_9->{department_id},$sub_hash->{id}) or error("Error in sth_11");
                    $sth->{11}->finish;
                }
            }
        }
    }

    ## status

    if(defined($sub_hash->{status_boolean})){

        my $status = $sub_hash->{status_boolean};

        if($status != 1){
            $status = 2;
        }

        $sql->{12} = qq(select status_to_user_manager_id as status_id from user_manager where user_manager_id = ?);
        $sth->{12} = $dbh->prepare($sql->{12}) or error("Error in sth_12");
        $sth->{12}->execute($sub_hash->{id}) or error("Error in sth_12");
        my $sql_result_12 = $sth->{12}->fetchrow_hashref || {};
        $sth->{12}->finish;

        if($sql_result_12->{status_id} ne $status){
            $sql->{13} = "update user_manager set updated = " . &_now_to_use() . ",status_to_user_manager_id = ? where user_manager_id = ?";
            $sth->{13} = $dbh->prepare($sql->{13}) or error("Error in sth_13");
            $sth->{13}->execute($status,$sub_hash->{id}) or error("Error in sth_13");
            $sth->{13}->finish;
        }
    }
    $dbh->disconnect;
}

sub modify_password {

    my ($sub_hash) = @_;

    my $dbh = &_db_handle($db_hash);
    my $sth = {};
    my $sql = {};

    my $sub_output = "Error changing password!";

    if( (defined($sub_hash->{rid})) && (defined($sub_hash->{new_password})) && (defined($sub_hash->{confirm_new_password})) ){
        if($sub_hash->{new_password} eq $sub_hash->{confirm_new_password}){

            my $new_password = &_generate_password({ password => $sub_hash->{new_password} });

            $sql->{1} = "update user_manager set updated = " . &_now_to_use() . ",password = ? where user_manager_id = ?";
            $sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
            $sth->{1}->execute($new_password, $sub_hash->{rid}) or error("Error in sth_1 execute");
            $sth->{1}->finish;

            $sub_output = "Updated password successfully!";
        }
    }
    $dbh->disconnect;
    return $sub_output;
}

sub filtering_select {

    my ($sub_hash) = @_;
    
    my $input = $sub_hash->{input} || undef;
    my $name  = $sub_hash->{name}     || undef;
    my $gid   = $sub_hash->{gid}      || undef;
    
    my $dbh = &_db_handle($db_hash);
    my $sth = {};
    my $sql = {};
    
    my $result_array = [];

    if($input){
        if($input eq "department"){

            $sql->{1} = qq(select department_id as id,description from department);
            $sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
            $sth->{1}->execute() or error("Error in sth_1 execute");
            my $sql_1_result = $sth->{1}->fetchall_arrayref({});
            $sth->{1}->finish;

            my $result_hash = {};
            
            my $first_key = undef;
            my $first_val = undef;
            
            my $sort_by   = undef;
            
            for my $row (@$sql_1_result){
                $result_hash->{ $row->{id} } = $row->{description};
            }
            
            
            ## Sort by key
            if($gid){
                if($gid =~ /^\d+$/){
                    if($result_hash->{ $gid }){
                        $first_val = $result_hash->{ $gid };
                        delete $result_hash->{ $gid };
                        $sort_by = 'key';
                    }
                }
            }
            
            ## Sort by value
            if($name){
                for(keys %$result_hash){
                    if($result_hash->{$_} eq $name){
                        $first_key = $_;
                        delete $result_hash->{ $_ };
                        $sort_by = 'val';
                        last;
                    }
                }
            }
            
            for(sort { $result_hash->{$a} cmp $result_hash->{$b} } keys %$result_hash){
                push @$result_array, { id => $_, name => $result_hash->{$_} };
            }
            
            if($sort_by){
                if($sort_by eq 'key'){
                    unshift @$result_array, { id => $gid, name => $first_val};
                }
                if($sort_by eq 'val'){
                    unshift @$result_array, { id => $first_key, name => $name};
                }
            }
        }
    }
    $dbh->disconnect;

    return ({ json_output => to_json($result_array, {utf8 => 0}) });
}

sub admin_grid {
    
    my ($sub_hash) = @_;
    
    my $content_range = $sub_hash->{content_range} || undef;
    my $table_name    = $sub_hash->{table_name}    || undef;

    my $dbh = &_db_handle($db_hash);
    my $sql = {};
    my $sth = {};

    my $result_array = [];

    ## Paging
    my $limit        = "100";
    my $offset       = "0";
    my $result_count = "";

    if( (defined($content_range)) && ($content_range =~ /items\=(\d+)\-(\d+)/) ){
        $offset = $1;
    }

    if($table_name){

        my $sql_1_result = {};

        if(config->{"dbi_to_use"} eq "SQLite"){
            $sql->{1} = qq(SELECT name as table_name FROM sqlite_master WHERE type = 'table' AND name = ?);
            $sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
            $sth->{1}->execute($table_name) or error("Error in sth_1 execute");
            $sql_1_result = $sth->{1}->fetchrow_hashref;
            $sth->{1}->finish;
        }
        else{
            if(config->{"dbi_to_use"} eq "Pg"){
                $sql->{1} = qq(select to_regclass(?) as table_name);
                $sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
                $sth->{1}->execute($table_name) or error("Error in sth_1 execute");
                $sql_1_result = $sth->{1}->fetchrow_hashref;
                $sth->{1}->finish;
            }
        }

        if($sql_1_result->{table_name}){ 

            my $table      = $sql_1_result->{table_name};
            my $table_id   = $table . "_id";
            my $row_status = "status_to_" . $table . "_id";

            $sql->{2} = qq(select $table_id as id, description, $row_status as status from $table);
            $sth->{2} = $dbh->prepare($sql->{2}) or error("Error in sth_2");
            $sth->{2}->execute() or error("Error in sth_2 execute");
            my $sql_2_result = $sth->{2}->fetchall_arrayref({});

            for my $row (@$sql_2_result){

                my $status = $row->{status} || 2;
                
                if($status eq 1){
                    $status = bless( do{\(my $o = 1)}, 'JSON::PP::Boolean' );
                }
                else{
                    $status = bless( do{\(my $o = 0)}, 'JSON::PP::Boolean' );
                }

                push @$result_array, { id             => $row->{id}, 
                                       description    => $row->{description},
                                       status         => $status };
            }
            $sth->{2}->finish;

            $sql->{count} = qq(select count($table_id) from $table);
            $sth->{count} = $dbh->prepare($sql->{count}) or error("Error in sth_count");
            $sth->{count}->execute() or error("Error in sth_count");
            my $sql_count_result = $sth->{count}->fetchrow_arrayref;
            $sth->{count}->finish;
            $result_count = $sql_count_result->[0];
        }
    }

    $dbh->disconnect;

    return ({ json_output   => to_json($result_array, {utf8 => 0}),
              content_range => $content_range,
              result_count  => $result_count });
}

sub admin_add {

    my ($sub_hash) = @_;

    my $table_name  = $sub_hash->{name}        || undef;
    my $description = $sub_hash->{description} || undef;

    my $dbh = &_db_handle($db_hash);
    my $sth = {};
    my $sql = {};

    my $sub_output = "Error addding description!";

    if($table_name){

        my $sql_1_result = {};

        if(config->{"dbi_to_use"} eq "SQLite"){
            $sql->{1} = qq(SELECT name as table_name FROM sqlite_master WHERE type = 'table' AND name = ?);
            $sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
            $sth->{1}->execute($table_name) or error("Error in sth_1 execute");
            $sql_1_result = $sth->{1}->fetchrow_hashref;
            $sth->{1}->finish;
        }
        else{
            if(config->{"dbi_to_use"} eq "Pg"){
                $sql->{1} = qq(select to_regclass(?) as table_name);
                $sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
                $sth->{1}->execute($table_name) or error("Error in sth_1 execute");
                $sql_1_result = $sth->{1}->fetchrow_hashref;
                $sth->{1}->finish;
            }
        }

        if($sql_1_result->{table_name}){

            my $table    = $sql_1_result->{table_name};
            my $table_id = $table . "_id";

            $sql->{2} = qq(select $table_id as id from $table where description = ?);
            $sth->{2} = $dbh->prepare($sql->{1}) or error("Error in sth_2");
            $sth->{2}->execute($description) or error("Error in sth_2 execute");
            my $sql_2_result = $sth->{2}->fetchrow_hashref;
            $sth->{2}->finish;

            if(not defined($sql_2_result->{id})){

                $sql->{2} = qq(insert into $table (description) values (?));
                $sth->{2} = $dbh->prepare($sql->{2}) or error("Error in sth_2");
                $sth->{2}->execute($description) or error("Error in sth_2 execute");
                $sth->{2}->finish;

                my $current_host_id = $dbh->last_insert_id(undef,undef,$table,undef) || undef;

                if($current_host_id){
                    $sub_output = "Added Description \"$description\" successfully!";
                }
            }
            else{
                $sub_output = "Error description already exists!";
            }
        }
    }
    $dbh->disconnect;
    return $sub_output;
}

sub modify_admin {

    my ($sub_hash) = @_;

    my $table_name  = $sub_hash->{table_name}  || undef;

    my $id          = $sub_hash->{id}          || undef;
    my $description = $sub_hash->{description} || "_NULL_";
    my $status      = $sub_hash->{status}      || 2;

    my $dbh = &_db_handle($db_hash);
    my $sth = {};
    my $sql = {};

    if($table_name){

        my $sql_1_result = {};

        if(config->{"dbi_to_use"} eq "SQLite"){
            $sql->{1} = qq(SELECT name as table_name FROM sqlite_master WHERE type = 'table' AND name = ?);
            $sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
            $sth->{1}->execute($table_name) or error("Error in sth_1 execute");
            $sql_1_result = $sth->{1}->fetchrow_hashref;
            $sth->{1}->finish;
        }
        else{
            if(config->{"dbi_to_use"} eq "Pg"){
                $sql->{1} = qq(select to_regclass(?) as table_name);
                $sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
                $sth->{1}->execute($table_name) or error("Error in sth_1 execute");
                $sql_1_result = $sth->{1}->fetchrow_hashref;
                $sth->{1}->finish;
            }
        }

        if($sql_1_result->{table_name}){

            my $table    = $sql_1_result->{table_name};
            my $table_id = $table . "_id";

            if($id){

                ## description
                
                $sql->{2} = qq(select description from $table where $table_id = ?);
                $sth->{2} = $dbh->prepare($sql->{2}) or error("Error in sth_2");
                $sth->{2}->execute($id) or error("Error in sth_2");
                my $sql_result_2 = $sth->{2}->fetchrow_hashref || {};
                $sth->{2}->finish;

                if($description ne $sql_result_2->{description}){

                    $sql->{3} = qq(select $table_id as id from $table where description = ?);
                    $sth->{3} = $dbh->prepare($sql->{3}) or error("Error in sth_3");
                    $sth->{3}->execute($description) or error("Error in sth_3");
                    my $sql_result_3 = $sth->{3}->fetchrow_hashref || {};
                    $sth->{3}->finish;

                    if(not defined($sql_result_3->{id})){

                        $sql->{4} = qq(update $table set description = ? where $table_id = ?);
                        $sth->{4} = $dbh->prepare($sql->{4}) or error("Error in sth_4");

                        if($description eq "_NULL_"){
                            $sth->{4}->execute(undef,$id) or error("Error in sth_4");
                        }
                        else{
                            $sth->{4}->execute($description,$id) or error("Error in sth_4");
                        }
                        $sth->{4}->finish;
                    }
                }

                ## status
                
                my $status_column  = "status_to_" . $table . "_id";

                $sql->{5} = qq(select $status_column as status from $table where $table_id = ?);
                $sth->{5} = $dbh->prepare($sql->{5}) or error("Error in sth_5");
                $sth->{5}->execute($id) or error("Error in sth_5");
                my $sql_result_5 = $sth->{5}->fetchrow_hashref || {};
                $sth->{5}->finish;

                if($status ne $sql_result_5->{status}){
                    $sql->{6} = qq(update $table set $status_column = ? where $table_id = ?);
                    $sth->{6} = $dbh->prepare($sql->{6}) or error("Error in sth_6");
                    $sth->{6}->execute($status,$id) or error("Error in sth_6");
                    $sth->{6}->finish;
                }
            }
        }
    }
    $dbh->disconnect;
}

sub _db_handle {

    my ($db_hash) = @_;

    my $dbh = undef;

    if($db_hash->{dbi_to_use} eq "SQLite"){
        $dbh = DBI->connect("dbi:$db_hash->{dbi_to_use}:dbname=$db_hash->{db}","","", {RaiseError => 1}) or croak("Could not connect to DB: $DBI::errstr");
        $dbh->{sqlite_unicode} = 1;
    }
    else{
        $dbh = DBI->connect("dbi:$db_hash->{dbi_to_use}:dbname=$db_hash->{db};host=$db_hash->{host};port=$db_hash->{port};","$db_hash->{username}","$db_hash->{password}") or croak("Could not connect to DB: $DBI::errstr");
    }
    
    return $dbh;
}

sub _now_to_use {

    my $result = 'NOW()';

    if(config->{"dbi_to_use"} eq "SQLite"){
        $result = '(datetime(\'now\',\'localtime\'))';
    }
    return $result;
}

sub _primary_key_to_use {

    my $result = 'serial primary key';

    if(config->{"dbi_to_use"} eq "SQLite"){
        $result = 'integer primary key';
    }
    if(config->{"dbi_to_use"} eq "mysql"){
        $result = 'int auto_increment primary key';
    }
    return $result;
}

sub _generate_password{
    
    my ($sub_hash) = @_;
    
    my $password = $sub_hash->{password} || undef;
    
    if(!$password){
        $password = &_generate_random_string('16');
    }    

    my $result = md5_hex($password);
    
    return $result;
}

sub _generate_random_string{
    
     my $length_of_randomstring = shift;
     my @chars=('a'..'z','A'..'Z','0'..'9');
     my $random_string;
 
     for(my $i = 0; $i < $length_of_randomstring; $i++){
       $random_string .= $chars[int(rand(58))];
     }    
 
     return $random_string;
}

## Login

sub _db_authen_processLogin {
    
	my ($sub_hash) = @_;
    
    my $username = $sub_hash->{username};
    my $password = $sub_hash->{password};
    
    my $sub_output = { session_authorized => 2, 
                       session_admin      => 2, 
                       login_message      => "User not authorized to login on this page." };
    
    if($username){
        my $user_exists = &_db_authen_fetchUser({ username => $username });
        if($user_exists->{id}){
            debug("User exists in DB");
            debug("Testing Authentication with DB");
            if($user_exists->{password} eq md5_hex($password)){
                debug("User authenticated with DB");
                $sub_output = { username           => $username,
                                uid                => $user_exists->{id},
                                fullname           => $user_exists->{fullname},
                                session_admin      => $user_exists->{privilege},
                                session_authorized => 1,
                                login_message      => "Logged in successfully" };
            }
            else{
                $sub_output->{login_message} = "Wrong password; please try again";
            }
        }
    }
    return $sub_output;
}

sub _db_authen_fetchUser {

    my ($sub_hash) = @_;

    my $dbh = &_db_handle($db_hash);
    my $sth = {};
    my $sql = {};

    $sql->{1} = qq(select user_manager_id,username,password,real_name,privilege_to_user_manager_id as privilege from user_manager where username = ?);
    $sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
    $sth->{1}->execute($sub_hash->{username}) or error("Error in sth_1 execute");
    my $sql_1_result = $sth->{1}->fetchrow_hashref;

    my $result = { id        => $sql_1_result->{user_manager_id},
                   password  => $sql_1_result->{password},
                   fullname  => $sql_1_result->{real_name},
                   privilege => $sql_1_result->{privilege} } || {};

    return $result;
}

sub _db_change_password {

    my ($sub_hash) = @_;

    my $dbh = &_db_handle($db_hash);
    my $sth = {};
    my $sql = {};

    my $sub_output = "Error changing password!";

    my $old_password = &_generate_password({ password => $sub_hash->{password} });

    my $new_password = &_generate_password({ password => $sub_hash->{npassword} });

    $sql->{1} = qq(select password from user_manager where username = ?);
    $sth->{1} = $dbh->prepare($sql->{1}) or error("Error in sth_1");
    $sth->{1}->execute($sub_hash->{username}) or error("Error in sth_1 execute");
    my $sql_1_result = $sth->{1}->fetchrow_hashref;

    if($sql_1_result->{password}){

        if($old_password eq $sql_1_result->{password}){

            $sql->{2} = qq(update user_manager set password = ? where username = ?);
            $sth->{2} = $dbh->prepare($sql->{2}) or error("Error in sth_2");
            $sth->{2}->execute($new_password, $sub_hash->{username}) or error("Error in sth_2 execute");
            $sth->{2}->finish;

            $sub_output = "Updated password successfully!";
        }
    }

    $sth->{1}->finish;
    $dbh->disconnect;

    return $sub_output;
}

true;
