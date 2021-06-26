const {
	override,
	getBabelLoader,
	addWebpackModuleRule
} = require("customize-cra");

const addAstroturf = plugin => config => {
	const babel = getBabelLoader(config);
	babel.loader = [
		{ loader: babel.loader, options: babel.options },
		{ loader: 'astroturf/loader', options: { extension: '.astroturf.css' } }
	];
	babel.options = undefined;
	return config;
};

module.exports = override(
	addWebpackModuleRule({ test: /\.(peg|ent)$/, use: 'raw-loader' }),
	addWebpackModuleRule({
		test: /\.astroturf\.css$/,
		use: ['style-loader', 'astroturf/css-loader'],
	}),
	addAstroturf()
);
