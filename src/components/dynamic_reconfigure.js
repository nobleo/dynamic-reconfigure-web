import ROSLIB from 'roslib';

/**
 * Dynamic reconfigure wrapper over a websocket connection to ROSBridge. This class allows the user to inspect and
 * update dynamic reconfigure parameters.
 */
export default class DynamicReconfigure {
	state = {
		rosClients: {},
		nodes: []
	};
	ros;

	/**
	 * Connect to the ROSBridge using a websocket.
	 * @param rosBridgeUrl {string} - The url of ROSBridge. If no protocol is specified it defaults to 'wss' under
	 * 'https' connections and 'ws' otherwise.
	 * @param onClose {function} - A callback function that is called when the connection closes.
	 * @param connectionTimeout {number} - Timeout for the connection in ms.
	 * @returns {Promise<(string|undefined)>} A promised that is rejected with an error message or resolved with undefined.
	 */
	connectTo(rosBridgeUrl, onClose = null, connectionTimeout = 2000) {
		return new Promise((resolve, reject) => {
			if (!rosBridgeUrl.startsWith('ws'))
				rosBridgeUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + rosBridgeUrl;

			this.ros = new ROSLIB.Ros({
				url: rosBridgeUrl
			});

			let conTimeouter = setTimeout(() => {
				reject('Connection timed out');
			}, connectionTimeout);

			this.ros.on('connection', () => {
				clearTimeout(conTimeouter);
				this.state.connectionEstablished = true;
				this.ros.on('close', () => {
					if (onClose)
						onClose();
				});
				resolve();
			});
			this.ros.on('error', e => {
				reject(e);
			});
		});

	}

	/**
	 * Get all the nodes that are available through the currently active ROSBridge connection.
	 * @returns {Promise<Array<Object>>} - An array of nodes in ROS.
	 */
	getNodes() {
		if (!this.state.rosClients.nodes)
			this.state.rosClients.nodes = new ROSLIB.Service({
				ros: this.ros,
				name: '/rosapi/nodes',
				serviceType: 'rosapi/Nodes'
			});

		return new Promise((resolve, reject) => {
			this.state.rosClients.nodes.callService(new ROSLIB.ServiceRequest(), result => {
				if (result)
					resolve(result.nodes);
				reject();
			});
		});
	}

	/**
	 * Extract all the parameters' minimum and maximum values from the ROS parameter_description.
	 * @param mins - An array of minimum values for the dynamic reconfigure parameters.
	 * @param maxs - An array of maximum values for the dynamic reconfigure parameters.
	 * @param defaults - An array of default values for the dynamic reconfigure parameters.
	 * @param params - The actual parameters to merge all the values into.
	 */
	extractMinAndMaxValues(mins, maxs, defaults, params) {
		for (let i = 0; i < mins.length; i++) {
			let p = params.find(par => par.name === mins[i].name);
			if (p) {
				p.min = mins[i].value;
				p.max = maxs[i].value;
				p.default = defaults[i].value;
			}
		}
	}

	/**
	 * Extract only the default values for a parameter. Used with strings and bools that do not have a min and max value.
	 * @param defaults {Array} - An array of objects containing the parameters' names and their default value.
	 * @param params {Array} - An array of parameters.
	 */
	extractDefaults(defaults, params) {
		for (let i = 0; i < defaults.length; i++) {
			let p = params.find(par => par.name === defaults[i].name);
			if (p)
				p.default = defaults[i].value.toString();
		}
	}

	/**
	 * Get the topics that are available on the ROS to which the websocket is connected.
	 * @returns {Promise<Array<string>>} - An array of names for the topics on ROS.
	 */
	getNodeDetails(node) {
		if (!this.state.rosClients.topics)
			this.state.rosClients.topics = new ROSLIB.Service({
				ros: this.ros,
				name: '/rosapi/node_details',
				serviceType: 'rosapi/NodeDetails'
			});

		let request = new ROSLIB.ServiceRequest({
			node: node.name
		});

		return new Promise(resolve => {
			this.state.rosClients.topics.callService(request, (result) => {
				resolve(result);
			});
		});
	}

	/**
	 * Get an unordered list of dynamic reconfigure parameters on the given node.
	 * @param dynamicParameterServer - The name of the dynamic reconfigure server to get parameters for.
	 * @returns {Promise<Array<Object>>} - An array of objects representing the dynamic reconfigure parameters, with min, max and default values set.
	 */
	getDynamicReconfigureParameters (dynamicParameterServer) {
		return new Promise((resolve, reject) => {
			let paraSub = (dynamicParameterServer + '/parameter_descriptions');
			this.subscribeTo(paraSub, 'dynamic_reconfigure/ConfigDescription', async msg => {
				var all_params_arrays = msg.groups.map((el) => {
					let params = el.parameters;
					this.extractMinAndMaxValues(msg.min.doubles, msg.max.doubles, msg.dflt.doubles, params);
					this.extractMinAndMaxValues(msg.min.ints, msg.max.ints, msg.dflt.ints, params);
					this.extractDefaults(msg.dflt.bools, params);
					this.extractDefaults(msg.dflt.strs, params);
					return params;
				});
				var all_params = [];
				all_params_arrays.forEach(all_params_array => {
					all_params = all_params.concat(all_params_array);
				});
				resolve(all_params);
			});
		});
	}

	/**
	 * Get a grouped list of nodes and their dynamic reconfigure parameters. Nodes that do not have dynamic reconfigure parameters are not included.
	 * @returns {Promise<Array>} - An array of objects, each representing a single dynamic reconfigure server.
	 */
	async getGroupedDynamicReconfigureParameters() {
		let nodes = await this.getNodes();
		nodes = Object.entries(nodes).map(n => ({ name: n[1] }));

		let dynReconfNodes = [];
		for (let i = 0; i < nodes.length; i++) {
			nodes[i].topics = [];
			let details = await this.getNodeDetails(nodes[i]);
			details.services.forEach(s => {
				if (s.includes('set_parameters')){
					nodes[i].topics.push(s.replace('/set_parameters', ''));
				}
			});

			if (nodes[i].topics.length > 0) {

				nodes[i].servers = [];
				for (let m = 0; m < nodes[i].topics.length; m++) {
					let dynParams = await this.getDynamicReconfigureParameters(nodes[i].topics[m]);
					nodes[i].servers.push({ name: nodes[i].topics[m], params: dynParams });
				}
				dynReconfNodes.push({ name: nodes[i].name,servers: nodes[i].servers });
			}
		}

		return dynReconfNodes;
	}

	/**
	 * Subscribe to a ROS topic with the given message type and callback.
	 * @param topicName {string} - The name of the topic to subscribe to.
	 * @param messageType {string} - A string representing the message type (as given by 'rostopic info topicName')
	 * @param onMessageReceived {Function<Object>} - A callback function, to which all messages are parsed.
	 */
	subscribeTo(topicName, messageType, onMessageReceived) {
		let listener = new ROSLIB.Topic({
			ros: this.ros,
			name: topicName,
			messageType
		});
		listener.subscribe(msg => {
			onMessageReceived(msg);
		});
	}

	/**
	 * Subscribe to parameter updates for the given server.
	 * @param server {Object} - An object representing the dynamic reconfigure server.
	 * @param server.name {string} - The name of the server.
	 * @param onMessageReceived {function<Object>} - A callback function that's called when the parameter values are updated.
	 */
	subscribeToParameterUpdates(server, onMessageReceived) {
		let topic = server.name + '/parameter_updates';
		this.subscribeTo(topic, 'dynamic_reconfigure/Config', onMessageReceived);
	}

	/**
	 * Update the parameters on the given server with the given changes.
	 * @param server {Object} - An object representing the server on which the parameters should be updated.
	 * @param changes {Array<Object>} - An array of changes that should be applied to the server.
	 * @returns {Promise<Object>} - A promise that is resolved with the new configuration of the server, as given by 'parameter_updates'.
	 */
	updateParamValues = (server, changes) => {
		let sp = server.name + '/set_parameters';

		let drc = new ROSLIB.Service({
			ros: this.ros,
			name: sp,
			serviceType: 'dynamic_reconfigure/Reconfigure'
		});

		let config = { bools: [], ints: [], strs: [], doubles: [], groups: [] };

		for (let i = 0; i < changes.length; i++) {
			switch (changes[i].parameter.type) {
				case 'int':
					config.ints.push({ name: changes[i].parameter.name, value: Number(changes[i].newValue) });
					break;
				case 'double':
					config.doubles.push({ name: changes[i].parameter.name, value: Number(changes[i].newValue) });
					break;
				case 'bool':
					config.bools.push({ name: changes[i].parameter.name, value: Boolean(changes[i].newValue) });
					break;
				case 'str':
					config.strs.push({ name: changes[i].parameter.name, value: changes[i].newValue });
					break;
				default:
					console.error('Invalid type for parameter ' + changes[i].parameter.name);
					break;
			}
		}

		let req = new ROSLIB.ServiceRequest({
			config
		});

		return new Promise(resolve => {
			drc.callService(req, res => {
				resolve(res.config);
			});
		});
	};
}
