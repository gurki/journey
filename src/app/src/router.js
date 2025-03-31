import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './components/HomeView.vue'
import TileGenerator from './components/TileGenerator.vue'

const routes = [
    {
        path: '/',
        name: 'home',
        component: HomeView
    },
    {
        path: '/generate',
        name: 'generate',
        component: TileGenerator
    }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

export default router