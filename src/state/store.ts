import { configureStore } from '@reduxjs/toolkit'
import { AsyncNodeStorage } from 'redux-persist-node-storage'
import { persistStore, persistReducer } from 'redux-persist'
import reducer from './reducer'

const persistConfig = {
  key: 'hue-hdmi-server',
  storage: new AsyncNodeStorage('/tmp/hue-hdmi-server')
}

const persistedReducer = persistReducer(persistConfig, reducer)

export const store = configureStore({
  reducer: persistedReducer
})

export const persistor = persistStore(store)

export type AppDispatch = typeof store.dispatch
export type RootState = ReturnType<typeof store.getState>

export default store
