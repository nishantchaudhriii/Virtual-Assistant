import React, { useContext, useEffect, useRef, useState } from 'react'
import { userDataContext } from '../context/UserContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import aiImg from "../assets/ai.gif"
import { CgMenuRight } from "react-icons/cg";
import { RxCross1 } from "react-icons/rx";
import userImg from "../assets/user.gif"
import { extractCommand, hasDevanagari, pickVoice } from "../utils/voice"

const FOLLOW_UP_MS = 12000   // after a reply you can keep talking WITHOUT repeating the name

function Home() {
  const { userData, serverUrl, setUserData, getGeminiResponse } = useContext(userDataContext)
  const navigate = useNavigate()
  const [listening, setListening] = useState(false)
  const [userText, setUserText] = useState("")
  const [aiText, setAiText] = useState("")
  const [ham, setHam] = useState(false)
  const [speechError, setSpeechError] = useState("")

  const recognitionRef = useRef(null)
  const isRecognizingRef = useRef(false)   // mic is currently on
  const isSpeakingRef = useRef(false)      // assistant is currently talking
  const busyRef = useRef(false)            // a command is being processed / answered
  const speakIdRef = useRef(0)             // lets us ignore events from a cancelled utterance
  const restartTimerRef = useRef(null)
  const followUpUntilRef = useRef(0)       // until when we accept commands without the name
  const voicesRef = useRef([])
  const nameRef = useRef(userData?.assistantName || "")
  const userNameRef = useRef(userData?.name || "")
  const unmountedRef = useRef(false)
  const restartDelayRef = useRef(200)      // grows if the mic keeps failing (e.g. no internet)

  nameRef.current = userData?.assistantName || ""
  userNameRef.current = userData?.name || ""

  const handleLogOut = async () => {
    try {
      await axios.get(`${serverUrl}/api/auth/logout`, { withCredentials: true })
      setUserData(null)
      navigate("/signin")
    } catch (error) {
      setUserData(null)
      console.log(error)
    }
  }

  // ----- microphone ---------------------------------------------------------
  const startRecognition = () => {
    if (unmountedRef.current || busyRef.current || isSpeakingRef.current || isRecognizingRef.current) return
    try {
      recognitionRef.current?.start()
    } catch (error) {
      if (error.name !== "InvalidStateError") console.error("Start error:", error)
    }
  }

  const scheduleRestart = (delay = 250) => {
    clearTimeout(restartTimerRef.current)
    restartTimerRef.current = setTimeout(startRecognition, delay)
  }

  // Called when one question/answer round is completely over -> go back to listening.
  const finishTurn = () => {
    busyRef.current = false
    isSpeakingRef.current = false
    setAiText("")
    setUserText("")
    followUpUntilRef.current = Date.now() + FOLLOW_UP_MS
    scheduleRestart(150)
  }

  // ----- speaking -----------------------------------------------------------
  const speak = (text) => {
    const synth = window.speechSynthesis
    const myId = ++speakIdRef.current
    let done = false
    let safetyTimer

    const finish = () => {
      if (done) return
      done = true
      clearTimeout(safetyTimer)
      // a newer utterance replaced this one -> let the newer one finish the turn
      if (myId !== speakIdRef.current) return
      finishTurn()
    }

    if (!synth || !text) { finish(); return }

    const utterance = new SpeechSynthesisUtterance(text)
    const wantHindi = hasDevanagari(text)
    const voices = voicesRef.current.length ? voicesRef.current : synth.getVoices()
    const voice = pickVoice(voices, wantHindi)
    utterance.lang = voice?.lang || (wantHindi ? "hi-IN" : "en-IN")
    if (voice) utterance.voice = voice
    utterance.rate = 1.05
    utterance.onend = finish
    utterance.onerror = finish

    // If the browser never tells us the speech ended, don't stay deaf forever.
    safetyTimer = setTimeout(finish, Math.min(45000, 4000 + text.length * 90))

    isSpeakingRef.current = true
    recognitionRef.current?.abort?.()   // never listen to our own voice
    synth.cancel()
    synth.speak(utterance)
  }

  // ----- actions ------------------------------------------------------------
  const handleCommand = (data) => {
    const { type, userInput, response } = data
    speak(response || "Sorry, I don't have an answer for that.")

    // Browsers may block pop-ups that open without a click - allow pop-ups for this site once.
    if (type === 'google-search') {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(userInput)}`, '_blank');
    }
    if (type === 'calculator-open') {
      window.open(`https://www.google.com/search?q=calculator`, '_blank');
    }
    if (type === "instagram-open") {
      window.open(`https://www.instagram.com/`, '_blank');
    }
    if (type === "facebook-open") {
      window.open(`https://www.facebook.com/`, '_blank');
    }
    if (type === "weather-show") {
      window.open(`https://www.google.com/search?q=weather`, '_blank');
    }
    if (type === 'youtube-search' || type === 'youtube-play') {
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(userInput)}`, '_blank');
    }
    if (type === 'website-open' && /^https:\/\//i.test(userInput || "")) {
      window.open(userInput, '_blank');
    }
  }

  const processTranscript = async (transcript) => {
    if (!transcript || busyRef.current || isSpeakingRef.current) return

    const { heard, command } = extractCommand(transcript, nameRef.current)
    const inFollowUp = Date.now() < followUpUntilRef.current
    if (!heard && !inFollowUp) {   // name not said first and the 12 seconds are over
      setUserText("")              // make sure no leftover text stays on screen
      return
    }

    busyRef.current = true
    clearTimeout(restartTimerRef.current)
    try { recognitionRef.current?.abort?.() } catch { /* ignore */ }
    isRecognizingRef.current = false
    setListening(false)

    // Only the name was said ("Shifra") -> say "Yes?"; the 12 seconds start when it finishes speaking.
    if (!command) {
      setUserText("")
      setAiText("Yes, I'm listening")
      speak("Yes?")
      return
    }

    setAiText("")
    setUserText(command)
    let data
    try {
      data = await getGeminiResponse(command)
    } catch {
      data = null
    }
    if (unmountedRef.current) return
    handleCommand(data || { response: "Sorry, I could not reach the server." })
    setAiText(data?.response || "")
  }

  // ----- setup / teardown ---------------------------------------------------
  useEffect(() => {
    unmountedRef.current = false

    // Voices load asynchronously in Chrome; cache them as soon as they are ready.
    const loadVoices = () => { voicesRef.current = window.speechSynthesis?.getVoices?.() || [] }
    loadVoices()
    window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoices)

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Firefox and some browsers don't support voice recognition - don't crash the page
      setSpeechError("Voice recognition is not supported in this browser. Please open the app in Google Chrome.");
      return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", loadVoices)
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-IN';
    recognition.interimResults = true;   // lets us show what you are saying live
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      isRecognizingRef.current = true;
      setListening(true);
      setSpeechError("");
    };

    // Chrome ends the session by itself after a few seconds of silence -> just start it again.
    recognition.onend = () => {
      isRecognizingRef.current = false;
      setListening(false);
      if (!unmountedRef.current) scheduleRestart(restartDelayRef.current);
    };

    recognition.onerror = (event) => {
      console.warn("Recognition error:", event.error);
      isRecognizingRef.current = false;
      setListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        // Do NOT keep retrying forever - tell the user what to fix.
        clearTimeout(restartTimerRef.current);
        busyRef.current = true;
        setSpeechError("Microphone access is blocked. Click the lock icon in the address bar, allow the microphone, then refresh the page.");
      } else if (event.error === "audio-capture") {
        setSpeechError("No microphone found. Please connect a microphone.");
      }
      else if (event.error !== "no-speech" && event.error !== "aborted") {
        // e.g. "network": retry, but slow down instead of hammering the speech service
        restartDelayRef.current = Math.min(restartDelayRef.current * 2, 5000);
      }
      // every error is followed by onend, which restarts the mic
    };

    recognition.onresult = (e) => {
      restartDelayRef.current = 200;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript.trim();

        if (!result.isFinal) {
          if (busyRef.current || isSpeakingRef.current || !text) continue;
          // Live preview: only show speech that is meant for the assistant
          const { heard, command } = extractCommand(text, nameRef.current);
          if (heard) setUserText(command || text);                         // name said first -> show the command part
          else if (Date.now() < followUpUntilRef.current) setUserText(text); // inside the 12 seconds
          else setUserText("");                                              // anything else -> show nothing
          continue;
        }
        processTranscript(text);
      }
    };

    // Greeting, then the mic starts as soon as it finishes (or immediately if speech is blocked).
    busyRef.current = true;
    speak(`Hello ${userNameRef.current}, what can I help you with?`);

    return () => {
      unmountedRef.current = true;
      clearTimeout(restartTimerRef.current);
      window.speechSynthesis?.removeEventListener?.("voiceschanged", loadVoices);
      window.speechSynthesis?.cancel();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      speakIdRef.current++;
      try { recognition.abort(); } catch { /* ignore */ }
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      setListening(false);
      isRecognizingRef.current = false;
      isSpeakingRef.current = false;
      busyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className='w-full h-[100vh] bg-gradient-to-t from-[black] to-[#02023d] flex justify-center items-center flex-col gap-[15px] overflow-hidden'>
      <CgMenuRight className='lg:hidden text-white absolute top-[20px] right-[20px] w-[25px] h-[25px]' onClick={() => setHam(true)} />
      <div className={`absolute lg:hidden top-0 w-full h-full bg-[#00000053] backdrop-blur-lg p-[20px] flex flex-col gap-[20px] items-start ${ham ? "translate-x-0" : "translate-x-full"} transition-transform`}>
        <RxCross1 className=' text-white absolute top-[20px] right-[20px] w-[25px] h-[25px]' onClick={() => setHam(false)} />
        <button className='min-w-[150px] h-[60px]  text-black font-semibold   bg-white rounded-full cursor-pointer text-[19px] ' onClick={handleLogOut}>Log Out</button>
        <button className='min-w-[150px] h-[60px]  text-black font-semibold  bg-white  rounded-full cursor-pointer text-[19px] px-[20px] py-[10px] ' onClick={() => navigate("/customize")}>Customize your Assistant</button>

        <div className='w-full h-[2px] bg-gray-400'></div>
        <h1 className='text-white font-semibold text-[19px]'>History</h1>

        <div className='w-full h-[400px] gap-[20px] overflow-y-auto flex flex-col truncate'>
          {userData.history?.map((his, i) => (
            <div key={i} className='text-gray-200 text-[18px] w-full h-[30px]  '>{his}</div>
          ))}

        </div>

      </div>
      <button className='min-w-[150px] h-[60px] mt-[30px] text-black font-semibold absolute hidden lg:block top-[20px] right-[20px]  bg-white rounded-full cursor-pointer text-[19px] ' onClick={handleLogOut}>Log Out</button>
      <button className='min-w-[150px] h-[60px] mt-[30px] text-black font-semibold  bg-white absolute top-[100px] right-[20px] rounded-full cursor-pointer text-[19px] px-[20px] py-[10px] hidden lg:block ' onClick={() => navigate("/customize")}>Customize your Assistant</button>
      <div className='w-[300px] h-[400px] flex justify-center items-center overflow-hidden rounded-4xl shadow-lg'>
        <img src={userData?.assistantImage} alt="" className='h-full object-cover' />
      </div>
      <h1 className='text-white text-[18px] font-semibold'>I'm {userData?.assistantName}</h1>
      {!aiText && <img src={userImg} alt="" className='w-[200px]' />}
      {aiText && <img src={aiImg} alt="" className='w-[200px]' />}

      <h1 className='text-white text-[18px] font-semibold text-wrap'>{userText ? userText : aiText ? aiText : null}</h1>
      {speechError
        ? <p className='text-red-400 text-[16px] text-center px-[20px]'>{speechError}</p>
        : <p className='text-gray-400 text-[14px]'>{listening ? `🎤 Listening… say "${userData?.assistantName}" and ask` : "…"}</p>}

    </div>
  )
}

export default Home