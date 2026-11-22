import react from 'eslint-plugin-react'
export default [
  { ignores:['**/dist/**','**/node_modules/**','cypress/screenshots/**','cypress/videos/**'] },
  { files:['**/*.{js,jsx,mjs}'],plugins:{ react },languageOptions:{ parserOptions:{ ecmaFeatures:{ jsx:true } } },
    rules:{ 'react/jsx-uses-vars':'error','react/jsx-uses-react':'error','no-unused-vars':['error',{ args:'none',caughtErrors:'none' }],'no-unreachable':'error','no-dupe-keys':'error' } },
]

