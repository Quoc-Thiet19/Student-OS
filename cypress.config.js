import { defineConfig } from 'cypress'
export default defineConfig({
  e2e:{
    baseUrl:'http://localhost:5173',supportFile:false,
    setupNodeEvents(on) {
      on('before:browser:launch',(browser,options) => {
        if (browser.family === 'chromium' && browser.name !== 'electron' && browser.isHeadless) {
          options.args.push('--window-size=1680,1100')
          options.args.push('--force-device-scale-factor=1')
        }
        return options
      })
    },
  },
  video:false,
})

