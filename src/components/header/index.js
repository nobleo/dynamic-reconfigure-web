import { h, Component } from 'preact';
import { route } from 'preact-router';
import TopAppBar from 'preact-material-components/TopAppBar';
import Drawer from 'preact-material-components/Drawer';
import List from 'preact-material-components/List';
import 'preact-material-components/Switch/style.css';
import 'preact-material-components/Dialog/style.css';
import 'preact-material-components/Drawer/style.css';
import 'preact-material-components/List/style.css';
import 'preact-material-components/TopAppBar/style.css';
import style from './style.css';

export default class Header extends Component {
	/**
	 * Close the drawer menu.
	 */
	closeDrawer() {
		this.drawer.MDComponent.open = false;
		this.state = {
			darkThemeEnabled: false
		};
	}

	/**
	 * Open the menu drawer.
	 */
	openDrawer = () => (this.drawer.MDComponent.open = true);
	/**
	 * Callback function that assigns the drawer component to 'this.drawer'.
	 * @param drawer {HTMLElement} - A reference to the drawer HTML element.
	 */
	drawerRef = drawer => (this.drawer = drawer);

	/**
	 * Link a menu item in the drawer to a given page.
	 * @param path
	 * @returns {Function}
	 */
	linkTo = path => () => {
		route(path);
		this.closeDrawer();
	};

	goHome = this.linkTo('/');
	goToConfigUpload = this.linkTo('/config-upload');

	render(props) {
		return (
			<div>
				<TopAppBar className="topappbar">
					<TopAppBar.Row>
						<TopAppBar.Section align-end>
							<TopAppBar.Icon className={style.padRight} menu onClick={this.openDrawer}>
								menu
							</TopAppBar.Icon>
						</TopAppBar.Section>
						<TopAppBar.Section align-start >
							<img className={style['toolbar-logo']} alt="ROS logo" src="/assets/imgs/logo.png" />
						</TopAppBar.Section>
					</TopAppBar.Row>
				</TopAppBar>
				<Drawer modal ref={this.drawerRef} dir="rtl">
					<Drawer.DrawerContent>
						<Drawer.DrawerItem selected={props.selectedRoute === '/'} onClick={this.goHome}>
							<List.ItemGraphic>build</List.ItemGraphic>
							Reconfigure Nodes
						</Drawer.DrawerItem>
					</Drawer.DrawerContent>
				</Drawer>
			</div>
		);
	}
}
