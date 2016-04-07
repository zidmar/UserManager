
create table status (
    status_id integer primary key,
    description varchar(50) not null
);

create table privilege (
    privilege_id integer primary key,
    description varchar(100) not null,
    status_to_privilege_id int4 not null DEFAULT 1,
    FOREIGN KEY (status_to_privilege_id) REFERENCES status (status_id)
);

create table department (
    department_id integer primary key,
    description varchar(100) not null,
    status_to_department_id int4 not null DEFAULT 1,
    FOREIGN KEY (status_to_department_id) REFERENCES status (status_id)
);

create table group_manager (
    group_manager_id integer primary key,
    description varchar(100) not null,
    status_to_group_manager_id int4 not null DEFAULT 1,
    FOREIGN KEY (status_to_group_manager_id) REFERENCES status (status_id)
);

create table user_manager (
    user_manager_id integer primary key,
    created timestamp not null,
    updated timestamp null,
    username varchar(50) not null UNIQUE,
    password varchar(50) not null,
    real_name varchar(50) not null,
    department_to_user_manager_id int4 not null DEFAULT 1,
    status_to_user_manager_id int4 not null DEFAULT 1,
    FOREIGN KEY (department_to_user_manager_id) REFERENCES department (department_id)
    FOREIGN KEY (status_to_user_manager_id) REFERENCES status (status_id)
);

create table role (
    role_id integer primary key,
    user_manager_to_role_id int4 not null,
    group_manager_to_role_id int4 not null,
    privilege_to_role_id int4 not null DEFAULT 2,
    status_to_role_id int4 not null DEFAULT 1,
    FOREIGN KEY (user_manager_to_role_id) REFERENCES user_manager (user_manager_id),
    FOREIGN KEY (group_manager_to_role_id) REFERENCES group_manager (group_manager_id),
    FOREIGN KEY (privilege_to_role_id) REFERENCES privilege (privilege_id)
    FOREIGN KEY (status_to_role_id) REFERENCES status (status_id)
);

insert into status (description) values ('Active');
insert into status (description) values ('Inactive');

insert into privilege (description) values ('Administrator');
insert into privilege (description) values ('PowerUser');
insert into privilege (description) values ('Read-Only User');

insert into department (description) values ('Department 1');
insert into department (description) values ('Department 2');

insert into group_manager (description) values ('UserManager');
insert into group_manager (description) values ('StuffTracker');

-- Administrator
insert into user_manager (created,username,password,real_name) 
values (datetime('now','localtime'),'admin','21232f297a57a5a743894a0e4a801fc3','Administrator');

insert into role (user_manager_to_role_id,group_manager_to_role_id,privilege_to_role_id,status_to_role_id) 
values (
    (select user_manager_id from user_manager where username = 'admin'),
    (select group_manager_id from group_manager where description = 'UserManager'),
    (select privilege_id from privilege where description = 'Administrator'),
    1
);

insert into role (user_manager_to_role_id,group_manager_to_role_id,privilege_to_role_id,status_to_role_id) 
values (
    (select user_manager_id from user_manager where username = 'admin'),
    (select group_manager_id from group_manager where description = 'StuffTracker'),
    (select privilege_id from privilege where description = 'Administrator'),
    1
);
