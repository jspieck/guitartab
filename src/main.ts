import { createApp } from 'vue'
import './assets/css/tokens.css'
import './assets/css/guitarTab.scss'
import './assets/css/toolbar.css'
import './style.css'
import './assets/css/compact.css'
import App from './App.vue'
import { installGlobalErrorHandlers } from './services/globalErrors'

const app = createApp(App)
installGlobalErrorHandlers(app)

app.mount('#app')
