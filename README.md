# Configure JS

Replace shell-format environment variables recursively. Provides capability in development environments similar to [envsubst](https://www.gnu.org/software/gettext/manual/html_node/envsubst-Invocation.html) with some additional features.

## How it works

Where you have an environment variable file:

**appsettings.development.env**

```
DB_ADMIN_PASSWORD=123456
DB_APP_USER_PASSWORD=654321
```
and a template file: 

**appsettings.Env.json.envt**

```
{
  "App": {
    "DbAdminPassword": "${DB_ADMIN_PASSWORD}",
    "DbAppUserPassword": "${DB_APP_USER_PASSWORD}",
  }
}
```

Include this script in your source and run the following command from within the top level directory from which recursive search should start:

```
node configure.js appsettings.development.env
```

In this case this would produce the file:

**appsettings.Development.json**

```
{
  "App": {
    "DbAdminPassword": "123456",
    "DbAppUserPassword": "654321",
  }
}
```

You can use version control system ignore scripts (e.g. `.gitignore`) to prevent the output files being committed, and prevent secrets being committed to repositories.

## Features

### (Optional) Case Controllable Environment Name in Output File Name

In the above example `appsettings.Env.json.envt` became `appsettings.Development.json`, from an environment file with the name `appsettings.development.env`

Note how the environment name segment `.Env.` in the template (`.envt`) file name was replaced with `.Development.` from the environment name segment of the input environment (`.env) file. The environment name segment in the template file can be `.Env` (pascal case), `.ENV` (upper case) or `.env` (lower case), and will output the environment name in the same case in the output file. Note that an environment name segment is optional.

### Reporting on Missing Variables in Template Files

This script will report where a variable in the environment file was not referenced in any template files.

### Reporting on Missing Variables in Envrionment Files

This script will report where a variable in the template file was not satisifed by the environment file.

## Licence

[MIT Licence](LICENSE.md)

## Buy Me a Coffee

https://www.buymeacoffee.com/gbro3n
