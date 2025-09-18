# Fenced Code Blocks with Tildes

## Basic triple tilde fence

~~~
hello world
~~~
1  2           3
@1 FencedOpen
@2 FencedContent "hello world\n"
@3 FencedClose

## Triple tilde with language info

~~~python
print("hello")
~~~
1      23             4
@1 FencedOpen
@2 FencedContent "print(\"hello\")\n"
@3 FencedClose

## Quadruple tilde fence

~~~~
nested ~~~code~~~ here
~~~~
1   2                   3
@1 FencedOpen
@2 FencedContent "nested ~~~code~~~ here\n"
@3 FencedClose