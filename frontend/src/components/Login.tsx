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
        <div className="fixed inset-0 z-[100] bg-[#f8fafc] flex flex-col items-center justify-center p-4 sm:p-8">
            {/* Logo o Marca decorativa opcional */}
            <div className="mb-8 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0B2545] to-[#1e3a8a] shadow-lg flex items-center justify-center text-white font-serif text-2xl font-bold">
                    GF
                </div>
                <h1 className="text-3xl font-serif font-bold text-[#0B2545] tracking-tight">
                    Gestor de Fondos
                </h1>
            </div>

            <div className="bg-white w-full max-w-md p-8 sm:p-10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 relative overflow-hidden transition-all">
                {/* Accent Top Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0B2545] via-[#1e3a8a] to-[#D4AF37]"></div>

                <div className="text-center mb-8">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Bienvenido de nuevo</h2>
                    <p className="text-sm text-slate-500">Inicia sesión para acceder a tu cartera</p>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">
                            Usuario
                        </label>
                        <input
                            type="email"
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-3.5 outline-none focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all placeholder:text-slate-400"
                            placeholder="tucorreo@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                </div>
                
                <div className="space-y-5 mt-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1 flex justify-between">
                            <span>Contraseña</span>
                        </label>
                        <input
                            type="password"
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-3.5 outline-none focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all placeholder:text-slate-400"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        />
                    </div>
                </div>

                <button
                    onClick={handleLogin}
                    disabled={isLoading || !email || !password}
                    className="w-full bg-[#0B2545] text-white py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-[#1e3a8a] shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex justify-center items-center mt-8"
                >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            <span>VERIFICANDO...</span>
                        </div>
                    ) : (
                        "ENTRAR AL GESTOR"
                    )}
                </button>
            </div>
            
            <p className="mt-8 text-xs text-slate-400 font-medium">
                &copy; {new Date().getFullYear()} Mi Boutique. Todos los derechos reservados.
            </p>
        </div>
    )
}
