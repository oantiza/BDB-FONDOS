import { useState } from 'react'

interface LoginProps { onLogin: (email: string, pass: string) => Promise<any> }
export default function Login({ onLogin }: LoginProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const handleLogin = async () => {
        if (!email || !password) return;
        setIsLoading(true)
        try {
            await onLogin(email, password)
        } catch (e) {
            console.error(e);
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] bg-brand flex items-center justify-center p-4">
            <div className="bg-white w-96 p-8 rounded shadow-2xl border-t-4 border-accent">
                <h2 className="text-3xl font-bold text-center mb-6 font-serif text-brand">Gestor de Fondos</h2>
                <input
                    type="email"
                    className="w-full border-b-2 p-3 mb-3 outline-none focus:border-accent text-slate-800"
                    placeholder="Usuario"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                />
                <input
                    type="password"
                    className="w-full border-b-2 p-3 mb-6 outline-none focus:border-accent text-slate-800"
                    placeholder="Clave"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
                <button
                    onClick={handleLogin}
                    disabled={isLoading || !email || !password}
                    className="w-full bg-brand text-white py-3 font-bold hover:bg-[#153e6e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                >
                    {isLoading ? (
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                        "ENTRAR"
                    )}
                </button>
            </div>
        </div>
    )
}
