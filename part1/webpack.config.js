import webpack from 'webpack';
import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';

export default {
    entry: {
        app: [
            'webpack-hot-middleware/client',
            path.join(__dirname, './src/index.js')
        ]
    },
    output: {
        filename: '[name].[hash].js',
        path: path.join(__dirname, './dev'),
        publicPath: '/'
    },
    plugins: [
        new webpack.EnvironmentPlugin([
            'NODE_ENV'
        ]),
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoErrorsPlugin(),
        new HtmlWebpackPlugin({
            template: path.join(__dirname, './index.html'),
            filename: 'index.html',
            inject: 'body'
        })
    ],
    module: {
        rules: [
            {
                test: /\.(js)$/,
                include: /src/,
                loader: 'babel-loader'
            }
        ]
    }
};
