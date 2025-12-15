import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('demo@nexus.com')
    const [password, setPassword] = useState('demo123')
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const handleLogin = async () => {
        setLoading(true)
        setError(null)
        try {
            await signInWithEmailAndPassword(auth, email, password)
            onLogin() // Notify parent
        } catch (err) {
            console.error(err)
            setError("Error de autenticación: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] bg-brand flex items-center justify-center p-4">
            <div className="bg-white w-96 p-8 rounded shadow-2xl border-t-4 border-accent">
                <h2 className="text-3xl font-bold text-center mb-6 font-serif text-brand">Gestor de Fondos</h2>
                {error && <div className="bg-red-100 text-red-700 p-2 mb-4 text-xs rounded">{error}</div>}
                <input
                    type="email"
                    className="w-full border-b-2 p-3 mb-3 outline-none focus:border-accent"
                    placeholder="Usuario"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                />
                <input
                    type="password"
                    className="w-full border-b-2 p-3 mb-6 outline-none focus:border-accent"
                    placeholder="Clave"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                />
                <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full bg-brand text-white py-3 font-bold hover:bg-[#153e6e] transition-colors disabled:opacity-50"
                >
                    {loading ? 'CONECTANDO...' : 'ENTRAR'}
                </button>
            </div>
        </div>
    )
}
