import axios from 'axios'
import React, { createContext, useEffect, useState } from 'react'
export const userDataContext = createContext()

// Uses the same hostname the page was opened with (localhost or 127.0.0.1) so the
// login cookie is always same-site. Override with VITE_SERVER_URL in frontend/.env if needed.
const serverUrl = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:8000`

function UserContext({ children }) {
    const [userData, setUserData] = useState(null)
    const [authLoading, setAuthLoading] = useState(true)
    const [frontendImage, setFrontendImage] = useState(null)
    const [backendImage, setBackendImage] = useState(null)
    const [selectedImage, setSelectedImage] = useState(null)

    const handleCurrentUser = async () => {
        try {
            const result = await axios.get(`${serverUrl}/api/user/current`, { withCredentials: true })
            setUserData(result.data)
        } catch (error) {
            // 401 just means "not logged in yet" - that's fine
            if (error.response?.status !== 401) console.log(error)
            setUserData(null)
        } finally {
            setAuthLoading(false)
        }
    }

    const getGeminiResponse = async (command) => {
        try {
            const result = await axios.post(`${serverUrl}/api/user/asktoassistant`, { command }, { withCredentials: true, timeout: 15000 })
            return result.data
        } catch (error) {
            console.log(error)
            if (error.code === "ECONNABORTED") return { response: "Sorry, that took too long. Please try again." }
            return error.response?.data?.response
                ? error.response.data
                : { response: "Sorry, I could not reach the server." }
        }
    }

    useEffect(() => {
        handleCurrentUser()
    }, [])

    const value = {
        serverUrl, userData, setUserData, authLoading,
        backendImage, setBackendImage, frontendImage, setFrontendImage,
        selectedImage, setSelectedImage, getGeminiResponse
    }
    return (
        <div>
            <userDataContext.Provider value={value}>
                {children}
            </userDataContext.Provider>
        </div>
    )
}

export default UserContext
