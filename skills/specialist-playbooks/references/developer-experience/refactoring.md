# Refactoring

- Refactor with the tests green before and after. A refactor without a test net is a rewrite with better manners.
- Work in small steps, each of which leaves the system working and each of which can be reverted.
- Detect the smells by name, because the catalogue gives you a shared vocabulary: the structural ones such as divergent change and shotgun surgery, the coupling ones such as feature envy and data clumps, and the size ones such as a long method, a large class, a long parameter list, and primitive obsession.
- Apply the mechanical refactorings from the catalogue first, since they are safe and they make the design refactorings possible.
- Replace a conditional with polymorphism when the branches are the same kind of decision. Replace a type code with subclasses when the type carries behaviour.
- Replace inheritance with delegation when the relationship is not really an is-a. Extract an interface when two classes share behaviour and not a concept.
- Introduce a parameter object when a function takes the same group of parameters in several places.
- Move behaviour to the object that owns the data. A function that has to ask another object for its state is a function in the wrong place.
- Use a characterisation test when the existing behaviour is untested and you do not know what it is. Capture the behaviour first, then change it deliberately.
- Use the golden-master technique when the output is large and only the shape is known. Compare the before and the after structurally rather than by eye.
- Keep the automated transformations available. An AST-aware refactoring is safer than a search-and-replace, and it is available in most editors.
- Do the mechanical part with the tool and the design part by hand. Mixing the two makes the diff unreadable and the mistake hard to find.
- Do not mix a refactor with a behaviour change. The reviewer cannot tell which is which, and the revert is ambiguous.
- Measure before and after. A refactor that claims a performance improvement needs a number, and a refactor that reduces complexity needs a metric.
- Update the documentation and the comments as you go, because a comment that describes the old design is worse than no comment.
