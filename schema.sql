create table users (
    user_id serial primary key,
    username varchar(50) unique not null,
    password_hash varchar(255) not null,
    is_active boolean default true
);
create table roles(
    role_id serial primary key,
    role_name varchar(50) unique not null,
    description varchar(300)
);
create table permissions(
    permission_id serial primary key,
    permission_key varchar(100) unique not null,
    description varchar(255)
);
create table user_roles(
    user_id int references users(user_id) on delete cascade,
    role_id int references roles(role_id) on delete cascade,
    primary key (user_id, role_id)
);
create table role_permissions(
    role_id int references roles(role_id) on delete cascade,
    permission_id int references permissions(permission_id) on delete restrict,
    primary key (role_id, permission_id)
);