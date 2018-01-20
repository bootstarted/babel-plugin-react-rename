# babel-plugin-react-rename

```js
import path from 'path';

export default (componentName, {filename, cwd}) => {
  return path.relative(cwd, path.dirname(filename));
}
```

```json
{
  "plugins": [
    ["babel-plugin-react-rename", {
      "only": "./src/component/**/*.js",
      "rename": "./config/babel/getComponentName.babel.js"
    }]
  ]
}
```
