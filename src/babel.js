import get from "lodash/get";

/**
 * [description]
 * @param {[type]} options.types: t [description]
 * @param {[type]} options.template [description]
 * @return {[type]} [description]
 */
export default function({ types: t, template }) {
  const WEBPACK_PROP = "webpackRequireWeakId";
  const SERVER_PROP = "serverSideRequirePath";

  const webpackTemplate = template(`() => require.resolveWeak(MODULE)`);
  const serverTemplate = template(`PATH.join(__dirname, MODULE)`);

  return {
    visitor: {
      ImportDeclaration(path) {
        const opts = {
          server: true,
          webpack: false,
          ...this.opts,
        };

        if (!opts.server && !opts.webpack) {
          return;
        }

        const source = get(path, "node.source.value");
        if (source !== "withAsync") {
          return;
        }

        const defaultSpecifier = path
          .get("specifiers")
          .find(specifier => specifier.isImportDefaultSpecifier());
        if (defaultSpecifier == null) {
          return;
        }

        const bindingName = get(defaultSpecifier, "node.local.name");
        const binding = path.scope.getBinding(bindingName);

        binding.referencePaths.forEach(refPath => {
          const callExpression = refPath.parentPath;
          if (!callExpression.isCallExpression()) {
            return;
          }

          const args = callExpression.get("arguments");
          if (args.length !== 1) {
            throw callExpression.error;
          }

          const options = args[0];
          if (!options.isObjectExpression()) {
            return;
          }

          const properties = options.get("properties");
          const propertiesMap = {};
          properties.forEach(property => {
            const key = property.get("key");
            propertiesMap[get(key, "node.name")] = property;
          });
          if (
            (opts.webpack == null || properties[WEBPACK_PROP] != null) &&
            (opts.server == null || properties[SERVER_PROP] != null)
          ) {
            return;
          }

          const loaderMethod = propertiesMap.loader.get("value");
          let dynamicImport;
          loaderMethod.traverse({
            Import(path) {
              dynamicImport = path.parentPath;
              path.stop();
            },
          });
          if (dynamicImport == null) {
            return;
          }

          const importedModule = dynamicImport.get("arguments")[0];

          if (opts.webpack != null && propertiesMap[WEBPACK_PROP] == null) {
            const webpack = webpackTemplate({
              MODULE: importedModule.node,
            }).expression;
            propertiesMap.loader.insertAfter(
              t.objectProperty(t.identifier(WEBPACK_PROP), webpack)
            );
          }

          if (opts.server != null && propertiesMap[SERVER_PROP] == null) {
            const server = serverTemplate({
              PATH: this.addImport("path", "default", "path"),
              MODULE: importedModule.node,
            }).expression;

            propertiesMap.loader.insertAfter(
              t.objectProperty(t.identifier(SERVER_PROP), server)
            );
          }
        });
      },
    },
  };
}
