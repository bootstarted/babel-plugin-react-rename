import * as t from '@babel/types';
import micromatch from 'micromatch';
import importFile from 'import-file';
import {relative, resolve} from 'path';

export function skip({ignore, only}, file) {
  if (only) {
    return micromatch(
      [file],
      Array.isArray(only) ? only : [only],
      {nocase: true}
    ).length <= 0;
  }
  if (ignore) {
    return micromatch(
      [file],
      Array.isArray(ignore) ? ignore : [ignore],
      {nocase: true}
    ).length > 0;
  }
  return false;
}

const classHasRenderMethod = (path) => {
  if (!path.node.body) {
    return false;
  }
  const members = path.node.body.body;
  for (let i = 0; i < members.length; i++) {
    if (members[i].type === 'ClassMethod' && members[i].key.name === 'render') {
      return true;
    }
  }
  return false;
};

function doesReturnJSX(path, state) {
  let found = false;
  path.traverse({
    // Can also check JSXText, JSXClosingElement, JSXIdentifier
    JSXOpeningElement: () => {
      found = true;
    },
    enter: (path) => {
      if (found) {
        path.skip();
      }
    },
  }, state);
  return found;
}

const setDisplayNameAfter = (path, nameNodeId, displayName) => {
  const blockLevelStmnt = path.find((path) => path.parentPath.isBlock());

  if (blockLevelStmnt) {
    const setDisplayNameStmn = t.expressionStatement(t.assignmentExpression(
      '=',
      t.memberExpression(nameNodeId, t.identifier('displayName')),
      t.stringLiteral(displayName)
    ));
    blockLevelStmnt.insertAfter(setDisplayNameStmn);
  }
};

const getTargetNode = (path) => {
  if (path.isClassDeclaration()) {
    return path.node.id;
  } else if (path.parentPath.isExportDefaultDeclaration()) {
    if (!path.node.id) {
      const id = path.parentPath.scope.generateDeclaredUidIdentifier('default');
      path.replaceWith(
        t.assignmentExpression('=', id, path.node)
      );
      return id;
    }
    return path.node.id;
  } else if (path.isArrowFunctionExpression() || path.isFunctionExpression()) {
    const node = path.findParent((p) => p.isVariableDeclarator()).node;
    return node.id;
  } else if (path.isFunctionDeclaration()) {
    return path.node.id;
  }
  throw new TypeError();
};

const getName = (node, state) => {
  const name = node.name || 'null';
  if (state.rename) {
    const {filename, file: {opts: {cwd}}} = state;
    return state.rename(name, {filename, cwd}) || name;
  }
  return name;
};

const createReactRenamePlugin = () => {
  const visitor = {
    ClassDeclaration(path, state) {
      path.skip();
      if (classHasRenderMethod(path)) {
        const id = getTargetNode(path);
        setDisplayNameAfter(path, id, getName(id, state));
      }
    },
    Function(path, state) {
      path.skip();
      if (!doesReturnJSX(path.get('body'), state)) {
        return;
      }
      // Ignore function expressions that aren't assigned to any variable.
      // e.g. func(() => <div/>); will be ignored.
      if (path.isArrowFunctionExpression() || path.isFunctionExpression()) {
        if (!path.findParent((p) => p.isVariableDeclarator())) {
          return;
        }
      }
      const id = getTargetNode(path);
      setDisplayNameAfter(path, id, getName(id, state));
    },
  };
  return {
    visitor: {
      Program(path, state)  {
        const {opts, filename, file: {opts: {cwd}}} = state;
        const name = filename ? relative(cwd, filename) : '<source>';
        if (filename && skip(opts, name)) {
          return;
        }
        if (typeof opts.rename === 'function') {
          state.rename = opts.rename;
        } else if (typeof opts.rename === 'string') {
          state.rename = importFile(resolve(cwd, opts.rename));
        }
        path.traverse(visitor, state);
      },
    },
  };
};

export default createReactRenamePlugin;
