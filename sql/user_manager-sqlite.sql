
create table status(
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

create table user_manager(
    user_manager_id integer primary key,
    created timestamp not null,
    updated timestamp null,
    username varchar(50) not null UNIQUE,
    password varchar(50) not null,
    real_name varchar(50) not null,
    privilege_to_user_manager_id int4 not null DEFAULT 2,
    department_to_user_manager_id int4 not null DEFAULT 1,
    status_to_user_manager_id int4 not null DEFAULT 1,
    FOREIGN KEY (privilege_to_user_manager_id) REFERENCES privilege (privilege_id),
    FOREIGN KEY (department_to_user_manager_id) REFERENCES department (department_id),
    FOREIGN KEY (status_to_user_manager_id) REFERENCES status (status_id)
);

insert into status (description) values ('ACTIVE');
insert into status (description) values ('INACTIVE');

insert into privilege (description) values ('Administrator');
insert into privilege (description) values ('User');
insert into privilege (description) values ('PowerUser');

insert into department (description) values ('Department 1');
insert into department (description) values ('Department 2');

-- Administrator
insert into user_manager (created,username,password,real_name,privilege_to_user_manager_id) values (datetime('now','localtime'),'admin','21232f297a57a5a743894a0e4a801fc3','Administrator',1);
