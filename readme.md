# Dynamic Reconfigure Web
This repository contains a Preact-based web frontend for ROS Dynamic Reconfigure.

![Screenshot of the UI](https://gitlab.com/aivero/dynamic-reconfigure/raw/master/UI.png "Screenshot of dynamic reconfigure web ui")


## Running
Two components are needed in order to run this project; ROS and Preact.

### Starting Preact:
The project uses npm, so make sure that is installed on your system first. The project is tested with version 6.7.0.
If npm is not installed on your system, please refer to [this installation guide](https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-18-04).

Open a terminal and run:
```bash
npm i
npm run dev
```
This starts a development server on port *8081* which hosts the website.

#### Building:
A production version of the web-based dynamic reconfigure can also be built. Sometimes it gives an error, as roslibjs
tries execute some code in the pre-rendering phase, which is dependent on `window`. In order to workaround these issues
run:
```bash
cd dynamic-reconfiure
npm i
sed -i '26i\if(typeof window !== "undefined")\' node_modules/roslib/node_modules/socket.io/lib/index.js
```
This outputs a bunch of files to the _build_-folder. These files can be served using e.g. nginx.

### Starting ROS:
The ROS setup needs a dynamic reconfigure server and rosbridge along with roscore. 

We're currently working on creating a sample server that can be used to explore the capabilities of this project. 
Until then we recommend creating a simple setup with roscore, rosbridge (accepting connections on port 8080) and 
a dynamic reconfigure server of your own choosing.