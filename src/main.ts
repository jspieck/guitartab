import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/css/guitarTab.scss'
import './style.css'
import './assets/css/compact.css'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia())
app.mount('#app')
