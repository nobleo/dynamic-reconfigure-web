import { h, Component } from 'preact';
import { Router } from 'preact-router';

import Header from './header';
import NotFound from '../routes/404';
import DynamicReconfigureComponent from '../routes/dynamic-reconfigure';

export default class App extends Component {
	/** Gets fired when the route changes.
	 *	@param e {Object} - "change" event from [preact-router](http://git.io/preact-router)
	 *	@param e.url {string} -	The newly routed URL
	 */
	handleRoute = e => {
		this.setState({
			currentUrl: e.url
		});
	};

	render() {
		return (
			<div id="app">
				<Header selectedRoute={this.state.currentUrl} />
				<Router onChange={this.handleRoute}>
					<DynamicReconfigureComponent path="/" />
					<NotFound default />
				</Router>
			</div>
		);
	}
}
