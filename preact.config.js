import asyncPlugin from 'preact-cli-plugin-async';

export default (config, env, helpers) => {
	asyncPlugin(config);
	config.devServer = {
		hot: true,
		quiet: true,
		publicPath: '/',
		historyApiFallback: true,
		port: 8081,
		proxy: [
			{
				path: '/api/**',
				target: 'http://localhost:5000'
			}
		]
	};
};