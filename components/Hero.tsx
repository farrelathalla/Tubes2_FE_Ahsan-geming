import Image from "next/image";
import Alchemist from "../public/elements/Alchemist.png";
import Dragon from "../public/elements/Dragon.png";

const Hero = () => {
  return (
    <section className="h-fit w-full">
      <div className="text-[#d68921] font-bold flex-col items-center justify-center text-center relative h-full overflow-ellipsis">
        <Image
          src={Alchemist}
          alt="Alchemist"
          className="absolute top-10 -left-10 w-32 animate-float rotate-12"
        />

        <Image
          src={Dragon}
          alt="Dragon"
          className="absolute top-10 -right-10 w-32 animate-float delay-1000 -rotate-12"
        />

        <p className="text-3xl font-normal pt-5 sing tracking-wider">
          WELCOME TO
        </p>
        <div className="flex flex-col items-center justify-center animate-float delay-2000 pt-3">
          <p className="text-8xl salty tracking-wider bg-gradient-to-b from-[#f8b763] to-[#d68921] inline-block text-transparent bg-clip-text">
            Little Alchemist 2 Finder
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;
