# Part 3: Production Build and Testing
So far, we've defined a project build that should only be used in development. After we've set up testing, let's create a usable production build that minifies our code and excludes any unnecessary libraries, such as Hot-Reloading.

Next, we'll add a testing framework to our application so we can be sure our code is solid when it gets deployed to production!

## Milestone 1: Production build
So far, we've had only one config file for our build - the development build. Let's modify our config to support production as well! Let's also split out our framework code from our application code during the build. We do this in order to cache the framework code on the client's browser so we don't have to pull it in every time they visit our app! This will lead to a significantly smaller download for our users on subsequent loads of our website.

Let's organize our configs inside a 'config' folder. In the root of our app, create a *config* folder and create three files:
* *webpack.base.config.js*
* *webpack.development.config.js*
* *webpack.production.config.js*

In *webpack.base.config.js*, we will house all of our base configuration shared between development and production. To help us merge these configurations easier, let's install **webpack-merge**:

```
npm install --save-dev webpack-merge
```

In *webpack.base.config.js*, let's copy over what we had from our old *webpack.config.js* and modify it a bit to look like this:

```
import webpack from 'webpack';
import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';

export default {
    entry: {
        vendor: ['react', 'react-dom', 'react-router', 'babel-polyfill']
    },
    output: {
        publicPath: '/'
    },
    module: {
        rules: [
            {
                enforce: 'pre',
                test: /\.(js)$/,
                include: /src/,
                loader: 'eslint-loader'
            },
            {
                test: /\.(js)$/,
                include: /src/,
                loaders: 'babel-loader'
            }
        ]
    },
    plugins: [
        new webpack.EnvironmentPlugin([
            'NODE_ENV'
        ]),
        new webpack.NoErrorsPlugin(),
        new webpack.NamedModulesPlugin(),
        new HtmlWebpackPlugin({
            template: path.join(__dirname, '../index.ejs'),
            filename: 'index.html',
            inject: true
        })
    ]
};
```

### webpack.base.config.js
Note that we now have an `entry` called 'vendor'. This is where we will house all of our framework code needed to run the app on the browser. It currently contains the React, ReactDOM, React-Router, and Babel-Polyfill libraries. If we add any more libraries needed to run our application, we should add them here. When the build is finished, it will output a file called *vendor.[generated_hash].js* containing all of our framework code. This makes for easy caching on the client.

We removed 'app' from our base `entry` so that the specific environment configurations define their own. This is because we need to add a few entry points in development so that HMR works correctly, while production won't need them. However, both development and production will share the same framework code, so we abstract that out here in the base config.

`output` contains only the publicPath for the server, which should stay the same for both dev and prod.

The `module` sections remains the same as the one in our old *webpack.config.js*. We need the same loaders in both dev and prod.

Our `plugins` array, however, looks a bit different. We've removed the HotModuleReplacementPlugin because we only need it in development. However, the rest of the plugins should be the same as our old config, save for one. We include the NamedModulesPlugin to get around how Webpack combines modules behind the scenes. It defaults to giving modules integer ids. If a module is changed, it's possible that all the ids change too and causes the cache to become invalid. NamedModulesPlugin makes it so Webpack chooses ids in a predictable way.

Finally, notice we've changed the `template` path to look from `index.ejs` rather than `index.html`. This will be important in the production configuration for getting caching to work correctly!

### webpack.development.config.js
```
import webpack from 'webpack';
import path from 'path';
import webpackMerge from 'webpack-merge';

import baseConfig from './webpack.base.config';

export default webpackMerge(baseConfig, {
    devtool: 'source-map',
    entry: {
        app: [
             // activate HMR for React
            'react-hot-loader/patch',
            //connect to the server to receive notifications when the bundle rebuilds
            'webpack-hot-middleware/client',
            //main app entry
            path.join(__dirname, '../src/index.js')
        ]
    },
    output: {
        filename: '[name].[hash].js',
        path: path.join(__dirname, '../dev')
    },
    plugins: [
        new webpack.LoaderOptionsPlugin({
            debug: true
        }),
        new webpack.HotModuleReplacementPlugin()
    ]
});
```

Our development config is now very simple. It includes a 'devtool' entry, which outputs a source map that allows us to see the original code when we debug so we get the benefit of line numbers. This makes debugging much easier. For a list of other options for source maps, check this [link](https://webpack.js.org/configuration/devtool/#devtool).

It includes the same 'entry' config as our original *webpack.config.js* file, which contains the entry points needed for HMR. `output` is the same as the our original webpack config, but note that we've change the relative path of the *dev* folder so that this folder ends up in the root of the app, not in the config folder.

In our plugins array, we've included HotModuleReplacementPlugin so that HMR is enabled in Webpack. We've also added the LoaderOptionsPlugin, allowing us to pass in parameters to the loaders. This is simply telling the loaders that we are in 'debug' mode (develoment), so turn off/on any special debug features as needed.

Note the use of 'webpackMerge' in the export. This will simply merge our baseConfig with the development config we've defined here.

### webpack.production.config.js
```
import webpack from 'webpack';
import path from 'path';
import webpackMerge from 'webpack-merge';
import InlineManifestWebpackPlugin from 'inline-manifest-webpack-plugin';

import baseConfig from './webpack.base.config';

export default webpackMerge(baseConfig, {
    entry: {
        app: [
            path.join(__dirname, '../src/index.js')
        ]
    },
    output: {
        filename: '[name].[chunkHash:8].js',
        chunkFilename: '[name].[chunkHash:8].chunk.js',
        path: path.join(__dirname, '../dist')
    },
    plugins: [
        new webpack.LoaderOptionsPlugin({
            minimize: true,
            debug: false
        }),
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false,
                screw_ie8: true,
                conditionals: true,
                unused: true,
                comparisons: true,
                dead_code: true,
                evaluate: true,
                if_return: true,
                join_vars: true
            },
            output: {
                comments: false
            }
        }),
        new webpack.optimize.CommonsChunkPlugin({
            name: ['vendor', 'manifest'],
            minChunks: Infinity
        }),
        new InlineManifestWebpackPlugin({
            name: 'webpackManifest'
        })
    ]
});
```
Our production config contains a similar entry to our development, but without the HMR dependencies.

Our `output` section has changed a bit. `path` will create a folder to output the generated files because we don't use Webpack-Dev-Middleware in production, so the files aren't stored in memory - they'll need to be written to disk. We modified `filename` to use `[chunkHash:8]` rather than `[hash]`. We've also added a section called `chunkFilename` that looks like `[name].[chunkHash:8].chunk.js`. Originally, we were using `[hash]`, which is the hash Webpack generates for the whole compilation. That meant if we make even a tiny change in the framework or application code, the compilation hash will be different.

Now that we've separated out the framework code, the hash of the compilation is no longer useful to us. If we change a single line of application, all the files will get a new hash, even though the framework code was not touched! That's not what we want.

The solution is to use 'chunkHash'. This is the hash for the 'chunk' of code that is generated by Webpack defined by our `entry` config. `chunkHash` scopes the hash to only the file we care about. So, if we make changes to our app code, only the `chunkHash` of the app code will change. Even cooler, since Webpack generates 'chunks' (code bundles) for each of our dynamic routes, if we only change the code for one of the dynamic routes, only that chunk will change have a new hash the next time we build. This completely isolates sections of the code and the browser will only update what it needs! Note that the ':8' at the end of `chunkHash` basically truncates the hash so the file name is shorter for the sake of readability.

Our config includes a few familiar `plugins`:
* LoaderOptionsPlugin to tell the loaders that we are **not** in `debug` mode, and that they should minimize their output by default.
* UglifyJSPlugin is used for minifying our JavaScript and getting rid of any unnecessary comments/code that don't belong in production. See [here](https://davidwalsh.name/compress-uglify) for more info about the included parameters.

The last two plugins, InlineManifestWebpackPlugin and CommonsChunkPlugin, allow us to perform caching correctly on the client side. This will require a small change to our *index.html* file for it to work correctly. Rename *index.html* to *index.ejs*. *EJS* files are JavaScript files that can include templates, which is how the HtmlWebpackPlugin works behind the scenes to add our *script* tags dynamically. To get caching working correctly, we need to add the following line below our root div in the *index.ejs* file:

```
    <%= htmlWebpackPlugin.files.webpackManifest %>
```

This is because of something that Webpack generates called a 'manifest'. The 'manifest' is a file that contains the Webpack runtime, dependency information, and a mapping of modules to module ids necessary to correctly load our application. If we don't extract the manifest, it will live in our `vendor` code bundle. Because the manifest changes with every build, the `chunkHash` will change as well, unnecessarily invalidating our hash and making our caching useless.

*CommonsChunkPlugin* is used for preventing duplication across the modules that Webpack splits out for us. Remember that the 'vendor' chunk, by default, includes the Webpack manifest. To move it out of `vendor`, we tell CommonsChunkPlugin to extract it by putting it in the `name` array. CommonsChunkPlugin can do a lot. It can even extract modules in your code if it's used a certain number of times in your code (defined by *minChunks*). Setting *minChunks* to Infinity basically tells CommonsChunkPlugin to separate out only the modules we've defined in the `name` array - the `vendor` code and the `manifest`.

Note that by extracting out modules, the browser has to make a GET request to grab it from the server. Because the *manifest* file is so small, we can inline it rather than make a GET request for it. This is what the *InlineManifestWebpackPlugin* does for us. It will take the *manifest.js* file generated by Webpack and inline it into the *index.ejs* where it finds the template `htmlWebpackPlugin.files.webpackManifest`.

That was a lot of setup! Let's run a production build and see the result of our effort. In the root of our app, run:

```
    NODE_ENV=production node -r babel-register ./node_modules/.bin/webpack --config ./config/webpack.production.config.js
```

To save time in the future, create a shortcut for this in *package.json*:

```
    scripts: {
        ...,
        "build:prod": "NODE_ENV=production node -r babel-register ./node_modules/.bin/webpack --config ./config/webpack.production.config.js"
    },
```

Now you can just run `npm run build:prod` instead!

Look inside the *dist* folder and see what we have so far:

* *0.[hash].chunk.js*, containing our *Home.js* code (separated out because it's a dynamic route using System.import)
* *1.[hash].chunk.js*, containing our *SignIn.js* code (another dynamic route extracted into it's own chunk/bundle)
* *app.[hash].js*, containing the rest of the app code we wrote ourselves
* *index.html*, containing the inlined Webpack manifest and script tags
* *manifest.[hash].js*, our manifest that gets inlined into *index.html*
* *vendor.[hash].js*, our framework code

Let's test that our caching works as expected. Make a small change to the text in the `render` function in *SignIn.js* and run the build again. Open the *dist* folder and notice none of the JavaScript files were changed. Only two new files were created - a new *manifest.[hash].js* and another *1.[hash].chunk.js* file (with a new hash) containing the updated code with the changes we made for *SignIn.js*. After we ran the build, *index.html* was updated with the new manifest, and only the bundle that contains the change we made was created. All the other files were isolated because we are using *chunkHash* rather than *hash*! Our caching is now working as we expect it to!

Let's do some clean-up now that we know everything is working correctly. Let's delete our old *webpack.config.js* file. Next, we'll modify our build script a little:

```
    scripts: {
        ...,
        "build:prod": "rm -rf ./dist; NODE_ENV=production node -r babel-register ./node_modules/.bin/webpack --config ./config/webpack.production.config.js"
    },
```
This blows out the old *dist* directory in order to keep its size small and containing only the files it needs. Now our caching works correctly!

## Milestone 2: Testing
Now that we've set up both development and production environments, let's create our testing framework. We'll focus on *unit* testing, but the framework we create can easily be used for end-to-end tests that can be run in real browsers! In the future, that maybe something worth adding to our application!

We'll use **Karma** to run our tests in different browser environments. **Mocha** will be our testing framework. We'll use it to set-up, tear-down, and give structure to our tests. **Chai** is an assertion library that gives us different ways to define expectations for our tests. **Sinon** is a mocking library, helpful for defining mocks, stubs, and spies we can use for testing components with dependencies. **Enzyme** is a cool library developed by AirBnb for testing React components.  **React-Addons-Test-Utils** is a testing library developed by Facebook that Enzyme is based on. It's a dependency that Enzyme needs to function correctly, so we'll need to install it too. Enzyme also depends on **React-DOM**, which we've already installed in a previous part of this tutorial.

### Side-note: Why so many libraries!?!
You might be wondering: why so many libraries? Why not just use **Jest** (Facebook's recommended framework) and be done with it!? Sadly, it's not all that simple. Let's talk through our choices (and our non-choices), one-by-one.

Why aren't we using Jest? After all, it's a fully-fledged framework based on Jasmine and developed by Facebook. In a few words: preference and familiarity.

Jest incorporates React testing tools already! While Jest definitely includes some useful like 'snapshot' and 'auto-mocking', most developers agree that the documentation isn't great. It's still a work-in-progress and Facebook is making huge strides in improving performance and usability of the framework. However, I believe Jest is a bit too heavy and it's still in flux. It recently received a huge update last September which changed a lot. Until Jest stabilizes a bit more, I believe the safer choice is to use the test framework we create here, and I also prefer the control and syntax of the libraries our testing framework is based on. That said, I believe Jest will definitely be worth considering in the future. Mostly, it's a matter of *preference*.

Using Karma as our test environment is extremely useful because it helps simulate the environment our code will be running in: the browser. It can help us detect browser-specific quirks or strange functionality differences during development! If we don't use Karma, we can definitely still run our tests, but we miss out on the powerful features it provides! It's definitely worth the few lines of setup. You might ask: is it even worth writing unit test suits against a real browser? It surely doesn't hurt! And in the future (if we desire to create some) our end-to-end tests will already have a browser environment set up with Karma!

Mocha, Chai, and Sinon are very standard JavaScript testing libraries that each serve a very specific purpose. It's definitely possible to use them (or even replace them) with a more complete solution like **Jasmine** or **Jest** and cut down on the libraries you're using. Again, doing so is simply a matter of preference. There are many more testing libraries available, but these three are very popular and widely used.

Finally, Enzyme is extremely helpful for isolating and testing React components. It's become a standard for testing React components. It provides an intuitive API and employs a concept called 'shallow rendering' to help isolate our React components and keep our tests as... 'unit'... as possible.

All of these libraries can live in harmony with each other. If you desired, you could use Jest and Enzyme together, or use Jasmine with Sinon. It's all up to preference!

### Side-side-note: What should we test?
While it's certainly possible to test too little, it's also possible to test too much. Generally, what we want to test in our application will be *functionality*. In our case, this means:

* Components - prop verification, were callbacks called?, did it render without errors?
* State management, e.g. Redux reducers, async action creators
* Services
* Utilities
* Edge cases
* End-to-end for critical paths (in the future)

While writing a test to ensure that a style was correctly placed when a button was clicked, it's definitely not a high priority test. Ensuring that we write useful tests for the critical parts of code will make our application much more robust. Keep this in mind when we start writing code!

### Unit testing: Back to our regularly scheduled program
Let's start by downloading and installing our core testing libraries:

```
npm install --save-dev karma mocha chai sinon enzyme react-addons-test-utils
```
We'll also need some adapter plugins for Karma to be able to use, understand, and play nice with these testing libraries. We install the respective adapter (prefaced with 'karma-') for each of our main testing libraries. We also need **karma-webpack** to have Webpack pre-process our source files before they're run by Karma. **karma-chrome-laucher** is necessary for Karma to use Chrome as our browser testing environment. There are also launchers for other browsers, like IE and Safari. We'll stick with Chrome for simplicity. Finally, **karma-sourcemap-loader** is super useful for quick debugging because it loads our source maps into the browser Karma launches for testing. This makes it much easier to look up line numbers for errors that appear in the browser.

```
npm install --save-dev karma-mocha karma-chai karma-sinon karma-webpack karma-chrome-launcher karma-sourcemap-loader
```

Now, let's begin our test framework setup. Let's start by setting up Karma. If you run `./node_modules/.bin/karma init`, you'll start a wizard that helps you set up Karma. Instead, let's bypass the wizard and simply create a *karma.config.js* file in the root of our application. It should look like this:

```
module.exports = (config) => {
    config.set({
        //Our framework list
        frameworks: ['mocha', 'chai', 'sinon'],
        //Our test files glob
        files: [
            'test/**/*.spec.js'
        ],
        //Use webpack and sourcemap to preprocess our files
        preprocessors: {
            'test/**/*.spec.js': ['webpack', 'sourcemap']
        },
        //Our testing webpack configuration
        webpack: {
            devtool: 'inline-source-map',
            module: {
                loaders: [
                    { test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/ }
                ]
            },
            resolve: {
                alias: { sinon: 'sinon/pkg/sinon' } // https://github.com/webpack/webpack/issues/177#issuecomment-185718237
            },
            //necessary for Enzyme to work
            //https://github.com/airbnb/enzyme/blob/master/docs/guides/karma.md#enzyme--karma--webpack
            externals: {
                cheerio: 'window',
                'react/addons': true,
                'react/lib/ExecutionEnvironment': true,
                'react/lib/ReactContext': true
            }
        },
        //Run our tests just once, if set to false then karma will watch our test files and re-run tests on changes
        singleRun: true,
        //Use Chrome for our browser test environment
        browsers: ['Chrome']
    });
};
```

The comments should thoroughly explain the config entries. Notice, in the 'webpack' entry, we are defining a very barebones Webpack configuration we use to pre-process our test and src files.

Let's create a simple test file to make sure our framework is running correctly.

Create a 'test' folder in the root of our application, and then create a *sample.spec.js* file with the following contents:

```
import React from 'react';
import { expect } from 'chai';
import { shallow } from 'enzyme';
import Home from '../src/pages/Home';

describe('Home page', () => {
    it('renders with no errors', () => {
        const wrapper = shallow(<Home />);
        expect(wrapper.type()).to.equal('div');
    });
});
```

This test simply asserts that our *Home* page is renders to a div. You may notice ESLint complaining about the use of 'to' and 'describe'. That's because it doesn't yet know we're using Mocha, Chai, and Sinon and their respective functions. While we could modify our *.eslintrc* to include the testing framework library functions, that would affect the rest of the application. Lucky for us, ESLint supports 'cascading configurations'. This means that if we simply create another *.eslintrc* that lives in our test folder, we'll 'inherit' the main *.eslintrc* in the root of our application. Then, we can define whatever rules we want that only affect the contents of the *test* folder! Let's do that now. In the *test* folder, create an *.eslintrc*:

```
{
    "env": {
        "mocha": true
    }
}
```

That solves the complaints from ESLint. Now, let's try running Karma in the root of the app:

```./node_modules/.bin/karma start```

And our test should pass! Our testing framework is now set up correctly. Let's quickly add modify the 'test' script our *package.json*:
```
  "scripts": {
    "test": "./node_modules/.bin/karma start",
    ...
  },

```

And now we can run `npm test` to run our tests!
