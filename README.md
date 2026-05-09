## Requirements:
1. mongodb


## Usage:
1. Install project `npm install`
1. Run [`mongod` server either locally](https://www.mongodb.com/docs/manual/administration/install-community/?operating-system=linux&linux-distribution=ubuntu&linux-package=default&search-linux=with-search-linux)
or run via docker. Example:
    ```bash
    # running locally installed mongodb
    sudo systemctl start mongod
    # or running via docker
    docker run -d -p 27017:27017 mongo:latest   
    ```
1. Run examples: `npm run example:mongo`
