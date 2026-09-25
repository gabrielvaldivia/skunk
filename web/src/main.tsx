import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Only Chromium can bend the page behind glass (SVG filters in backdrop-filter);
// elsewhere the liquid glass stays frosted. See .liquid-glass in index.css.
const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands
if (brands?.some((b) => b.brand === 'Chromium')) document.documentElement.classList.add('glass-refract')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
