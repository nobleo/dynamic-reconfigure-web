import { Component } from 'preact';
import Card from 'preact-material-components/Card';
import 'preact-material-components/Card/style.css';
import 'preact-material-components/Button/style.css';
import TextField from 'preact-material-components/TextField';
import 'preact-material-components/TextField/style.css';
import Checkbox from 'preact-material-components/Checkbox';
import Formfield from 'preact-material-components/FormField';
import 'preact-material-components/Checkbox/style.css';
import style from './style.css';
import Select from 'preact-material-components/Select';
import 'preact-material-components/Select/style.css';
import DynamicReconfigure from '../../components/dynamic_reconfigure';
import linkState from 'linkstate';
import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';
import toast from '../../components/toast';
import Icon from 'preact-material-components/Icon';
import 'preact-material-components/Icon/style.css';
import AutoCompleter from 'preact-material-autocompleter';

/**
 * The dynamic reconfigure component is a page that allows the user to update ROS nodes remotely. It displays nodes in
 * separate cards and allows the user to filter among his nodes.
 */
export default class DynamicReconfigureComponent extends Component {
	/**
	 * Preact state, which is used to hold objects that are displayed on the screen.
	 * @type {{servers: Array, chosenIndex: number, storedConfiguration: Array, connectedToRos: boolean, rosUrl: string }}
	 */
	state = {
		servers: [],
		storedConfiguration: [],
		connectedToRos: false,
		rosUrl: 'localhost:8080'
	};

	/**
	 * A component function that's called when the component is mounted. This function acts somewhat as a constructor,
	 * but only when running in a browser.
	 * All browser-related tasks are carried out here.
	 */
	componentDidMount() {
		this.dr = new DynamicReconfigure();
		this.connectToRos();
	}

	/**
	 * Merge the ROS parameter descriptions and parameter updates into a single list of objects.
	 * @param rosValueCollection - The collection of current parameter values.
	 * @param server - The server to which the parameters belong.
	 */
	assignValues(rosValueCollection, server) {
		rosValueCollection.forEach(v => {
			let param = server.params.find(p => p.name === v.name);
			param.value = v.value;
		});
	}

	/**
	 * Find the changes applied to a parameter.
	 * @param server {Object} - An object representing the server to which the parameter belongs.
	 * @param param {string} - The name of the parameter to find changes for.
	 * @returns {(Object|undefined)} - An object holding new and old values for the parameter or undefined if
	 * no changes has been applied to the parameter.
	 */
	findParameterChange = (server, param) => server.changes ? server.changes.find(c => c.parameter === param) : undefined;
	/**
	 * Get the display value of a parameter, i.e. the new value if a change has been applied to it and the old if not.
	 * @param server {Object} - An object representing the server to which the parameter belongs.
	 * @param param {Object} - An object representing the parameter.
	 * @returns {string} - The value of the parameter to display on screen.
	 */
	getDisplayValue = (server, param) => {
		let pt = this.findParameterChange(server, param);
		return pt ? pt.newValue : param.value;
	};

	/**
	 * Load all dynamic reconfigure parameters that are available.
	 */
	loadDynamicParameters () {
		this.dr.getGroupedDynamicReconfigureParameters().then(r => {
			this.setState({ servers: r });

			for (let i = 0; i < r.length; i++) {
				for (let m = 0; m < r[i].servers.length; m++) {
					//Subscribe to updates for each of the nodes. This will also give current values on first call.
					this.dr.subscribeToParameterUpdates(r[i].servers[m], msg => {
						//Invoked each time a message is received: merges new values into the node's state
						this.assignValues(msg.bools, r[i].servers[m]);
						this.assignValues(msg.ints, r[i].servers[m]);
						this.assignValues(msg.doubles, r[i].servers[m]);
						this.assignValues(msg.strs, r[i].servers[m]);

						this.setState({ servers: r });
					});
				}
			}
		}).catch(e => {
			console.error(e);
			toast('An error occurred', e, 'error');
		});
	}

	/**
	 * Callback function for when a user changes a parameter on the UI.
	 * @param e the event which represents the change.
	 * @param param - A reference to the parameter that was changed.
	 * @param server - A reference to the server to which the parameter belongs.
	 * @param fieldName {string} - The name of the field to extract under event.target
	 * @param modifier {function} - A function that can be used to process the value of the field. Used for instance when selecting enums.
	 */
	onParamChange(e, param, server, fieldName, modifier) {
		let paramRow = e.target.closest('tr');
		//check that the parameter falls within min and max, if they are set
		if ((param.max && (e.target.value > param.max)) || (param.min && e.target.value < param.min)) {
			paramRow.classList.add(style.errorParam);
			server.changes = server.changes.filter(c => c.parameter !== param);

			return;
		}

		paramRow.classList.add(style.edited);
		paramRow.classList.remove(style.errorParam);
		if (!server.changes)
			server.changes = [];
		let existingChange = this.findParameterChange(server, param);

		let modifiedParamValue = modifier ? modifier(e.target[fieldName]) : e.target[fieldName];
		if (!existingChange) {
			server.changes.push({ parameter: param, newValue: modifiedParamValue, target: e.target });
		}
		else
			existingChange.newValue = modifiedParamValue;
	}

	/**
	 * Binding function, that creates a subscription to the onParamChange event. It creates a change log for the given
	 * change and adds a CSS class the row.
	 * @see {@link onParamChange}
	 */
	bindParamChange = (parameter, server, targetName = 'value', modifier = undefined) => e => this.onParamChange(e, parameter, server, targetName, modifier);

	/**
	 * Render an enum select (i.e. dropdown menu) with the given parameter, server and description.
	 * @param param {Object} - An object representing the parameter.
	 * @param server {Object} - An object representing the server.
	 * @param enumDescription {Object} - An object containing the enum description, i.e. the values and explanations associated with the enum.
	 * @returns {HTMLElement} - An HTMLElement that represents the enum.
	 */
	renderEnumSelect = (param, server, enumDescription) => (
		<Select hintText={enumDescription.enum_description} selectedIndex={this.getDisplayValue(server, param) + 1}
			onChange={this.bindParamChange(param, server, 'selectedIndex', v => v - 1)}
		>
			{enumDescription.enum.map(e => <Select.Item>{e.name + ` (${e.value})`}</Select.Item>)}
		</Select>
	);

	/**
	 * Expand or collapse an 'Additional Information' field.
	 * @param e {Event} - The event fired from the user clicking on the expand button.
	 */
	toggleAdditionalInformation = (e) => {
		e.target.expanded = e.target.expanded === undefined ? true : !e.target.expanded;
		let row = e.target.closest('tr');

		row.getElementsByClassName('mdc-icon')[0].innerHTML = e.target.expanded ? 'expand_less' : 'expand_more';
		row.getElementsByClassName(style.expandCaption)[0].innerHTML = e.target.expanded ? 'Less Details' : 'Show Details';
		row.classList.toggle(style.shown);
	};

	/**
	 * Gets an edit field for the parameter that corresponds to its type.
	 * @param parameter {Object} - An object representing the parameter.
	 * @param server {Object} - An object representing the server to which the parameter belongs.
	 * @returns {HTMLElement} - An edit field for the parameter.
	 */
	getEdit = (parameter, server) => {
		switch (parameter.type) {
			case 'str':
				return <TextField type="text" label="String value" value={this.getDisplayValue(server, parameter)} onChange={this.bindParamChange(parameter, server)} />;
			case 'int':
				if (parameter.edit_method) {
					let jsonFormatted = parameter.edit_method.replace(/'/g, '"');
					let enumDesc = JSON.parse(jsonFormatted);
					parameter.enumDescriptions = enumDesc.enum;
					return this.renderEnumSelect(parameter, server, enumDesc);
				}
				return <TextField type="number" label="Integer value" value={this.getDisplayValue(server, parameter)} onChange={this.bindParamChange(parameter, server)} />;
			case 'double':
				return <TextField type="number" label="Floating point value" value={this.getDisplayValue(server, parameter)} step="0.001" onChange={this.bindParamChange(parameter, server)} />;
			case 'bool':
				return (
					<Formfield>
						<Checkbox id={parameter.name + '-checkbox'} checked={this.getDisplayValue(server, parameter)} onChange={this.bindParamChange(parameter, server, 'checked')} />
						<label className={style.checkboxLabel} for={parameter.name + '-checkbox'}>Enabled</label>
					</Formfield>);
			default:
				return <p>Parameter of unsupported type</p>;
		}
	};

	/**
	 * Render the given dynamic reconfigure parameter.
	 * @param parameter - The parameter to render.
	 * @param server - The server to which the parameter belongs.
	 * @returns {HTMLElement} - A table row displaying the parameter's details and values.
	 */
	renderDynamicReconfigureRow(parameter, server) {
		let edit = this.getEdit(parameter, server);

		return (
			<tr>
				<td className={style.mobileStrong}>{parameter.name}</td>
				<td className={style.noMobile}>{parameter.min}</td>
				<td>{edit}</td>
				<td className={style.onlyMobile}><span>Minimum: </span>{parameter.min}</td>
				<td><span className={style.onlyMobile}>Maximum: </span>{parameter.max}</td>
				<td><span className={style.onlyMobile}>Default: </span>{parameter.default}</td>
				<td className={[style.onlyMobile, style.clickableText].join(' ')} onClick={this.toggleAdditionalInformation}>
					<span className={style.expandCaption}>Show Details</span>
					<Icon>expand_more</Icon>
				</td>
			</tr>
		);
	}

	/**
	 * Clears the highlight indicating that parameters on a server has been changed.
	 * @param server - The server to clear the highlight for
	 * @param valueAssigner {Function<Object, string>} - A function that takes a change and returns the value to assign to the given parameter's input field.
	 */
	clearEditHighlight(server, valueAssigner) {
		server.changes.forEach(c => {
			c.target.closest('tr').classList.remove(style.edited);
			c.target.closest('tr').classList.remove(style.errorParam);
			let oldVal = valueAssigner(c);
			c.parameter.value = oldVal;
			c.target.value = oldVal;
			c.target.selectedIndex = oldVal + 1;
		});
		server.changes = [];
	}

	/**
	 * Save the changes made to the parameters on a server.
	 * @param server - The server to save.
	 */
	save(server) {
		if (server.changes.length === 0) {
			return;
		}
		this.dr.updateParamValues(server, server.changes).then(r => {
			toast('The parameters were updated');
			this.clearEditHighlight(server, c => c.newValue);
		}).catch(e => {
			toast('Parameter update failed', e, 'error');
		});
	}

	/**
	 * Reject the changes made to a server, reverting them to their previous values.
	 * @param server - The server to revert changes for.
	 */
	reject(server) {
		this.setState({ rejectServer: server });
		this.confirmDialog.MDComponent.show();
	}

	/**
	 * Render a dynamic reconfigure card for the given dynamic reconfigure server.
	 * @param dynamicReconfigureServer - The server to render
	 * @returns {*} - A Preact HTML element that represents the card.
	 */
	renderDynamicReconfigureCard(dynamicReconfigureServer) {
		// console.info("size of dynreconf " + dynamicReconfigureServer.params.length);
		let params = [];
		if (dynamicReconfigureServer.params.length === 0)
			return;

		//Render a row in the table for each parameter on the server
		dynamicReconfigureServer.params.forEach(p => {
			params.push(this.renderDynamicReconfigureRow(p, dynamicReconfigureServer));
		});

		return (
			<Card class={style.card}>
				<div className={style.cardHeader}>
					<h2 className={['mdc-typography--title', style.mobileHideMargin].join(' ')}>Reconfigure {dynamicReconfigureServer.name}</h2>
				</div>
				<div className={style.cardBody}>
					<table className={style.drTable}>
						<tr>
							<th>Parameter</th>
							<th>Min</th>
							<th>Value</th>
							<th>Max</th>
							<th>Default</th>
						</tr>
						{params}
					</table>
				</div>
				<Card.Actions>
					<Card.ActionButtons>
						<Card.ActionButton onClick={e => this.save(dynamicReconfigureServer)}>SAVE</Card.ActionButton>
						<Card.ActionButton onClick={e => this.reject(dynamicReconfigureServer)}>REJECT</Card.ActionButton>
					</Card.ActionButtons>
				</Card.Actions>
			</Card>
		);
	}

	/**
	 * Callback function that is invoked when the user changes the ROS url.
	 * @param ev {event} - Input event from the url input field.
	 */
	onUrlInput = (ev) => {
		this.setState({ rosUrl: ev.target.value });
	};

	/**
	 * Connect to ROS and load parameter values if we succeed.
	 */
	connectToRos = () => {
		this.dr.connectTo(this.state.rosUrl, () => {
			toast('Could not connect to ROS', 'Connection closed', 'error');
			this.setState({ connectedToRos: false });
		}).then(() => {
			this.loadDynamicParameters();
			this.setState({ connectedToRos: true });
		}).catch(e => {
			toast('Could not connect to ROS', e, 'error');
			this.setState({ connectedToRos: false });
		});
	};

	/**
	 * Render a card that is displayed when the connection to ROS closes or fails.
	 * @param connected {boolean} - A flag to indicate whether or not we're currently connected to ROS.
	 * @returns {(HTMLElement|undefined)} - A card in which the user can input a url or nothing if we're connected.
	 */
	WebsocketErrorCard = ({ connected }) => {
		if (connected)
			return;

		return (
			<Card class={style.card} >
				<div className={style.cardHeader} >
					<h2 className="mdc-typography--title">ROS Connection Not Established</h2>
				</div>
				<div className={style.cardBody} >
					<TextField className={style.wideTextField} label="ROSBridge URL" onChange={this.onUrlInput} value={this.state.rosUrl} />
				</div>
				<Card.Actions>
					<Card.ActionButtons>
						<Card.ActionButton onClick={this.connectToRos} >CONNECT</Card.ActionButton>
					</Card.ActionButtons>
				</Card.Actions>
			</Card>
		);
	};

	/**
	 * Render a dialog that is displayed when the user attempts to reject changes applied to a node to confirm that he
	 * actually wants to clear them.
	 * @returns {HTMLElement} - A dialog where the user can confirm that he wants to undo changes made to the server.
	 */
	rejectConfirmationDialog = () => (
		<Dialog ref={dlg => this.confirmDialog = dlg} onAccept={e => this.clearEditHighlight(this.state.rejectServer, c => c.parameter.value)} onCancel={e => this.setState({ rejectServer: undefined })}>
			<Dialog.Header>Reject changes to {this.state.rejectServer ? this.state.rejectServer.name : 'NO SERVER'}?</Dialog.Header>
			<Dialog.Body>
					This action reverts all changes to their former values and will not affect the dynamic reconfigure server.
					All changes you have made will be lost and must manually be entered against, should you regret.
			</Dialog.Body>
			<Dialog.Footer>
				<Dialog.FooterButton cancel>Cancel</Dialog.FooterButton>
				<Dialog.FooterButton accept>Accept</Dialog.FooterButton>
			</Dialog.Footer>
		</Dialog>
	);

	render (props, state, context) {
		let serverCards = [];
		let chosenNode = this.state.servers.find(s => s.name === this.state.chosenServer);
		if (chosenNode) {
			chosenNode.servers.forEach(s => {
				serverCards.push(this.renderDynamicReconfigureCard(s));
			});
		}
		else {
			this.state.servers.forEach(s => {
				s.servers.forEach(n => {
					serverCards.push(this.renderDynamicReconfigureCard(n));
				});
			});
		}

		return (
			<div className={style.appContainer}>
				<Card class={style.card}>
					<div className={style.cardHeader}>
						<h2 className={['mdc-typography--title', style.mobileHideMargin].join(' ')}>Filter servers</h2>
					</div>
					<div className={style.cardBody}>
						<AutoCompleter items={this.state.servers.map(s => s.name)} hintText="Choose a ROS Node" className={style.serverFilter} onChange={e => this.setState({chosenServer: e.target.value})} />
					</div>
				</Card>

				{serverCards}
				<this.WebsocketErrorCard connected={this.state.connectedToRos} />
				<this.rejectConfirmationDialog server={this.state.rejectServer} />
			</div>
		);
	}
}
