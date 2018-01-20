import expect from 'unexpected';
import path from 'path';
import vm from 'vm';
import {transformFile} from '@babel/core';

describe('index', () => {
  function transform(fixture, options) {
    const file = path.join('.', 'test', 'fixture', `${fixture}.fixture.js`);
    return (new Promise((resolve, reject) => {
      transformFile(
        file,
        {
          plugins: [[
            require.resolve('../../src/createReactRenamePlugin'),
            options,
          ]],
          presets: ['@babel/react'],
          sourceMaps: true,
          ast: false,
        },
        (err, data) => err ? reject(err) : resolve(data)
      );
    })).then((data) => {
      return {file, data};
    });
  }

  function run(fixture, {error: handlesError = false} = { }) {
    return transform(fixture).then(({data, file}) => {
      const sandbox = vm.createContext({});
      let error = null;
      sandbox.global = { };
      sandbox.exports = { };
      sandbox.require = require;
      try {
        vm.runInContext(data.code, sandbox);
      } catch (err) {
        error = err;
      }
      if (!handlesError && error) {
        return Promise.reject(error);
      }
      return {
        file,
        exports: sandbox.exports,
        code: data.code,
        error,
      };
    });
  }

  it('should work on exported named stateless components', () => {
    return run('statelessExport').then(({exports}) => {
      expect(exports.bar.displayName, 'to equal', 'bar');
    });
  });

  it('should work on exported default stateless components', () => {
    return run('statelessDefault').then(({exports}) => {
      expect(exports.default.displayName, 'to equal', '_default');
    });
  });

  it('should work on function declarations', () => {
    return run('functionDeclaration').then(({exports}) => {
      expect(exports.default.displayName, 'to equal', 'functionDeclaration');
    });
  });

  it('should work on function declarations', () => {
    return run('functionExpression').then(({exports}) => {
      expect(exports.default.displayName, 'to equal', 'functionExpression');
    });
  });

  it('should work on non-exported stateless components', () => {
    return run('arrowFunction').then(({exports}) => {
      expect(exports.default.displayName, 'to equal', 'arrowFunction');
    });
  });

  it('should work on classes', () => {
    return run('class').then(({exports}) => {
      expect(exports.default.displayName, 'to equal', 'MyComponent');
    });
  });
});
