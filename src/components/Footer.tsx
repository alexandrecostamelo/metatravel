import { Plane } from "lucide-react";

const Footer = () => (
  <footer className="gradient-navy text-primary-foreground/70 py-10 mt-auto">
    <div className="container mx-auto px-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-gold" />
          <span className="font-bold text-primary-foreground">Meta<span className="text-gradient-gold">Travel</span></span>
        </div>
        <p className="text-sm text-center">
          © {new Date().getFullYear()} MetaTravel. Todos os direitos reservados.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
