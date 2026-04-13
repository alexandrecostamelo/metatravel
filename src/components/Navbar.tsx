import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plane, Menu, X, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 gradient-navy border-b border-navy-light/30">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2">
          <Plane className="h-6 w-6 text-gold" />
          <span className="text-xl font-bold text-primary-foreground">
            Meta<span className="text-gradient-gold">Travel</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-4">
          <Link to="/busca" className="text-primary-foreground/80 hover:text-gold transition-colors text-sm font-medium">
            Buscar
          </Link>
          {user ? (
            <>
              <Link to="/historico" className="text-primary-foreground/80 hover:text-gold transition-colors text-sm font-medium">
                Minhas Buscas
              </Link>
              <Button variant="navOutline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="navOutline" size="sm">Entrar</Button>
              </Link>
              <Link to="/cadastro">
                <Button variant="gold" size="sm">Cadastrar</Button>
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden text-primary-foreground" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden gradient-navy border-t border-navy-light/30 px-4 pb-4 space-y-3">
          <Link to="/busca" className="block text-primary-foreground/80 hover:text-gold py-2" onClick={() => setOpen(false)}>
            Buscar
          </Link>
          {user ? (
            <>
              <Link to="/historico" className="block text-primary-foreground/80 hover:text-gold py-2" onClick={() => setOpen(false)}>
                Minhas Buscas
              </Link>
              <Button variant="navOutline" size="sm" onClick={handleLogout} className="w-full">
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)}>
                <Button variant="navOutline" size="sm" className="w-full">Entrar</Button>
              </Link>
              <Link to="/cadastro" onClick={() => setOpen(false)}>
                <Button variant="gold" size="sm" className="w-full mt-2">Cadastrar</Button>
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
