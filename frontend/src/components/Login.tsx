import { useState } from 'react'

export default function Login({ onLogin }) {
    const [isLoading, setIsLoading] = useState(false)

    const handleLogin = async () => {
        setIsLoading(true)
        try {
            await onLogin()
        } catch (e) {
            setIsLoading(false)
        }
        // Note: onLogin should trigger auth change which unmounts this component
    }

    return (
        <div className="fixed inset-0 z-[100] bg-brand flex items-center justify-center p-4">
            <div className="bg-white w-96 p-8 rounded shadow-2xl border-t-4 border-accent">
                <h2 className="text-3xl font-bold text-center mb-6 font-serif text-brand">Nexus Terminal</h2>
                <input
                    type="email"
                    className="w-full border-b-2 p-3 mb-3 outline-none focus:border-accent"
                    placeholder="Usuario"
                    defaultValue="demo@nexus.com"
                    disabled={isLoading}
                />
                <input
                    type="password"
                    className="w-full border-b-2 p-3 mb-6 outline-none focus:border-accent"
                    placeholder="Clave"
                    defaultValue="demo123"
                    disabled={isLoading}
                />
                <button
                    onClick={handleLogin}
                    disabled={isLoading}
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
