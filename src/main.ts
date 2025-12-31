import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/css/guitarTab.scss'
import App from './App.vue'
import store from "./assets/js/store";

const app = createApp(App)

app.use(createPinia())
app.use(store)
app.mount('#app')
