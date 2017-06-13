/* global __webpack_require__ __webpack_modules__ : true */
import React, { PureComponent } from "react";

const SERVER_SIDE_REQUIRE_PATHS = new Set();
const WEBPACK_REQUIRE_WEAK_IDS = new Set();

/* eslint-disable camelcase */
const isWebpack = __webpack_require__ != null;
const requireFn = isWebpack ? __webpack_require__ : module.require.bind(module);
/* eslint-enable camelcase */
const babelInterop = obj => (obj && obj.__esModule ? obj.default : obj);
const tryRequire = (resolveModuleFn, pathOrId) => {
  try {
    return resolveModuleFn(requireFn(pathOrId));
  } catch (err) {
    return null;
  }
};

/**
 * [withAsync description]
 * @param {[type]} options [description]
 * @return {[type]} [description]
 */
export default function withAsync(options) {
  const {
    loader,
    LoadingComponent,
    delay = 200,
    serverSideRequirePath,
    webpackRequireWeakId,
    resolveModule: resolveModuleFn = babelInterop,
  } = options;
  let isLoading = false;
  let outsideComponent = null;
  let outsidePromise = null;
  let outsideError = null;

  if (!isWebpack && serverSideRequirePath) {
    outsideComponent = tryRequire(resolveModuleFn, serverSideRequirePath);
  }

  const load = () => {
    if (outsidePromise == null) {
      isLoading = true;
      outsidePromise = loader()
        .then(Component => {
          isLoading = false;
          outsideComponent = resolveModuleFn(Component);
        })
        .catch(error => {
          isLoading = false;
          outsideError = error;
        });
    }

    return outsidePromise;
  };

  return class AsyncComponent extends PureComponent {
    _timeout;
    _mounted;

    /**
     * [preload description]
     * @return {[type]} [description]
     */
    static preload() {
      return load();
    }

    /**
     * [constructor description]
     * @param {[type]} props [description]
     */
    constructor(props) {
      super(props);
      if (outsideComponent == null && isWebpack && webpackRequireWeakId) {
        const weakId = webpackRequireWeakId();
        if (__webpack_modules__[weakId] != null) {
          outsideComponent = tryRequire(resolveModuleFn, weakId);
        }
      }

      this.state = {
        error: outsideError,
        pastDelay: false,
        Component: outsideComponent,
      };
    }

    /**
     * [componentWillMount description]
     */
    componentWillMount() {
      const { Component } = this.state;
      this._mounted = true;

      if (Component != null) {
        return;
      }

      this._timeout = setTimeout(() => {
        this.setState({ pastDelay: true });
      }, delay);

      load().then(() => {
        if (!this._mounted) {
          return;
        }
        clearTimeout(this._timeout);
        this.setState({
          error: outsideError,
          pastDelay: false,
          Component: outsideComponent,
        });
      });
    }

    /**
     * [componentWillUnmount description]
     */
    componentWillUnmount() {
      this._mounted = false;
      clearTimeout(this._timeout);
    }

    /**
     * [render description]
     * @return {[type]} [description]
     */
    render() {
      const { pastDelay, error, Component } = this.state;

      if (!isWebpack && serverSideRequirePath != null) {
        SERVER_SIDE_REQUIRE_PATHS.add(serverSideRequirePath);
      }

      if (isWebpack && webpackRequireWeakId) {
        WEBPACK_REQUIRE_WEAK_IDS.add(webpackRequireWeakId());
      }

      if (isLoading || error != null) {
        return (
          <LoadingComponent
            isLoading={isLoading}
            pastDelay={pastDelay}
            error={error}
          />
        );
      } else if (Component) {
        return <Component {...this.props} />;
      } else {
        return null;
      }
    }
  };
}

/**
 * [flushServerSideRequirePaths description]
 * @return {[type]} [description]
 */
export function flushServerSideRequirePaths() {
  const arr = Array.from(SERVER_SIDE_REQUIRE_PATHS);
  SERVER_SIDE_REQUIRE_PATHS.clear();
  return arr;
}

/**
 * [flushWebpackRequireWeakIds description]
 * @return {[type]} [description]
 */
export function flushWebpackRequireWeakIds() {
  const arr = Array.from(WEBPACK_REQUIRE_WEAK_IDS);
  WEBPACK_REQUIRE_WEAK_IDS.clear();
  return arr;
}
