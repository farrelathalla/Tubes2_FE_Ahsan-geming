import Hero from "../components/Hero";
import Search from "../components/Search";
import TreePage from "../components/TreePage";
const page = () => {
  return (
    <main className="bg-gradient-to-b from-[#260026] to-[#53053d] w-full min-h-screen p-20">
      <Hero />
      <Search />
      {/* <TreePage /> */}
    </main>
  );
};

export default page;
