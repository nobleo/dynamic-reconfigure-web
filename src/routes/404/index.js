import { h, Component } from 'preact';
import Card from 'preact-material-components/Card';
import 'preact-material-components/Card/style.css';
import style from './style.css';

/**
 * The NotFound Component is displayed when the user navigates to a route for which no component is defined.
 */
export default class NotFound extends Component {
	render() {
		return (
			<div class={style.appContainer}>
				<Card>
					<div class={style.cardHeader}>
						<h2 class=" mdc-typography--title">Page not found.</h2>
					</div>
					<div class={style.cardBody}>
						Looks like the page you are trying to access, doesn't exist.
					</div>
				</Card>
			</div>
		);
	}
}
