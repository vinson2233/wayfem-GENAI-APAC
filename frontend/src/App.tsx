import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import TripResultsPage from './pages/TripResultsPage'
import SafetyReportPage from './pages/SafetyReportPage'
import HotelsPage from './pages/HotelsPage'
import CommunityPage from './pages/CommunityPage'
import CheckInPage from './pages/CheckInPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="trip/:tripId" element={<TripResultsPage />} />
          <Route path="safety" element={<SafetyReportPage />} />
          <Route path="hotels" element={<HotelsPage />} />
          <Route path="community" element={<CommunityPage />} />
          <Route path="checkin/:tripId" element={<CheckInPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
